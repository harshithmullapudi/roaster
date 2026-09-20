mod config;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;
use url::{form_urlencoded, Url};

const MAIN_WINDOW: &str = "main";

/// Tells the web app it is running inside the desktop shell. Runs before page
/// scripts on every navigation, which is why sign-in can branch on it without
/// the webview needing any Tauri IPC access.
const DESKTOP_MARKER: &str = "window.__ROSTER_DESKTOP__ = true;";

/// Links to anywhere but the Roster deployment open in the real browser. A
/// webview with no chrome has no back button, so following an outbound link
/// in-window would strand the user.
fn is_internal(url: &Url, app_url: &Url) -> bool {
    match url.scheme() {
        "http" | "https" => {
            url.host_str() == app_url.host_str()
                && url.port_or_known_default() == app_url.port_or_known_default()
        }
        "about" | "blob" | "data" => true,
        _ => false,
    }
}

/// `roster://auth?token=…` carries a better-auth one-time token minted in the
/// browser that just verified a magic link. Handing it to the web app rather
/// than consuming it here means the session cookie is set by the server, on a
/// response the webview itself received — the one way to get a cookie into
/// WKWebView's jar without touching cookie APIs.
fn session_url(deep_link: &Url, app_url: &Url) -> Option<Url> {
    if deep_link.scheme() != "roster" || deep_link.host_str() != Some("auth") {
        return None;
    }

    let param = |name: &str| {
        deep_link
            .query_pairs()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.into_owned())
            .filter(|value| !value.is_empty())
    };

    let token = param("token")?;

    let mut query = form_urlencoded::Serializer::new(String::new());
    query.append_pair("token", &token);
    if let Some(next) = param("next") {
        query.append_pair("next", &next);
    }

    let mut target = app_url.clone();
    target.set_path("/api/desktop/session");
    target.set_query(Some(&query.finish()));
    Some(target)
}

fn handle_deep_link(app: &AppHandle, url: &Url, app_url: &Url) {
    let Some(target) = session_url(url, app_url) else {
        return;
    };

    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };

    let _ = window.navigate(target);
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

pub fn run() {
    let app_url = config::resolve_app_url();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup({
            let app_url = app_url.clone();
            move |app| {
                let handle = app.handle().clone();

                WebviewWindowBuilder::new(
                    app,
                    MAIN_WINDOW,
                    WebviewUrl::External(app_url.clone()),
                )
                .title("Roster")
                .inner_size(1280.0, 840.0)
                .min_inner_size(760.0, 540.0)
                .initialization_script(DESKTOP_MARKER)
                .on_navigation({
                    let handle = handle.clone();
                    let app_url = app_url.clone();
                    move |url| {
                        if is_internal(url, &app_url) {
                            return true;
                        }
                        let _ = handle.opener().open_url(url.as_str(), None::<&str>);
                        false
                    }
                })
                .build()?;

                app.deep_link().on_open_url({
                    let handle = handle.clone();
                    let app_url = app_url.clone();
                    move |event| {
                        for url in event.urls() {
                            handle_deep_link(&handle, &url, &app_url);
                        }
                    }
                });

                tauri::async_runtime::spawn(update_on_launch(handle));

                Ok(())
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Roster");
}

/// Updates are applied at launch only. Swapping the bundle out from under
/// someone mid-session would lose whatever they were typing.
async fn update_on_launch(app: AppHandle) {
    use tauri_plugin_updater::UpdaterExt;

    let Ok(updater) = app.updater() else {
        return;
    };

    match updater.check().await {
        Ok(Some(update)) => {
            if update.download_and_install(|_, _| {}, || {}).await.is_ok() {
                app.restart();
            }
        }
        Ok(None) => {}
        Err(error) => eprintln!("update check failed: {error}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn app_url() -> Url {
        Url::parse("https://roster.example.com").unwrap()
    }

    fn session_url_for(deep_link: &str) -> Option<String> {
        let parsed = Url::parse(deep_link).unwrap();
        session_url(&parsed, &app_url()).map(|url| url.to_string())
    }

    #[test]
    fn redeems_a_token_against_the_deployment() {
        assert_eq!(
            session_url_for("roster://auth?token=abc123").as_deref(),
            Some("https://roster.example.com/api/desktop/session?token=abc123")
        );
    }

    #[test]
    fn carries_the_destination_through() {
        assert_eq!(
            session_url_for("roster://auth?token=abc&next=%2Fjoin%2Fx").as_deref(),
            Some("https://roster.example.com/api/desktop/session?token=abc&next=%2Fjoin%2Fx")
        );
    }

    #[test]
    fn re_encodes_a_token_that_needs_it() {
        assert_eq!(
            session_url_for("roster://auth?token=a%2Bb%2Fc%3D%3D").as_deref(),
            Some("https://roster.example.com/api/desktop/session?token=a%2Bb%2Fc%3D%3D")
        );
    }

    #[test]
    fn ignores_links_that_are_not_ours() {
        assert_eq!(session_url_for("https://evil.example.com/?token=abc"), None);
        assert_eq!(session_url_for("roster://open?token=abc"), None);
    }

    #[test]
    fn ignores_a_link_carrying_no_token() {
        assert_eq!(session_url_for("roster://auth"), None);
        assert_eq!(session_url_for("roster://auth?token="), None);
        assert_eq!(session_url_for("roster://auth?next=%2F"), None);
    }

    #[test]
    fn keeps_the_port_when_the_deployment_has_one() {
        let dev = Url::parse("http://localhost:3000").unwrap();
        let link = Url::parse("roster://auth?token=abc").unwrap();
        assert_eq!(
            session_url(&link, &dev).map(|url| url.to_string()).as_deref(),
            Some("http://localhost:3000/api/desktop/session?token=abc")
        );
    }

    #[test]
    fn treats_only_the_deployment_as_internal() {
        let internal = |url: &str| is_internal(&Url::parse(url).unwrap(), &app_url());

        assert!(internal("https://roster.example.com/tasks"));
        assert!(internal("about:blank"));
        assert!(!internal("https://github.com/redplanethq"));
        assert!(!internal("http://roster.example.com.evil.test/"));
        assert!(!internal("mailto:someone@example.com"));
    }

    #[test]
    fn a_different_port_on_the_same_host_is_not_the_deployment() {
        let dev = Url::parse("http://localhost:3000").unwrap();
        let other = Url::parse("http://localhost:9999/").unwrap();
        assert!(!is_internal(&other, &dev));
    }
}

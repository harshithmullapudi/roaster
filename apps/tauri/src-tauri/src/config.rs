use std::{fs, path::PathBuf};

use serde::Deserialize;
use url::Url;

const DEFAULT_APP_URL: &str = "https://web-production-86be2.up.railway.app";
const DEV_APP_URL: &str = "http://localhost:3000";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RosterConfig {
    frontend_url: Option<String>,
}

/// Deliberately not `~/.roster/config.json`: that file belongs to the CLI,
/// which rewrites it wholesale on `roster login` and would drop anything the
/// app had put there.
fn config_path() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(|home| PathBuf::from(home).join(".roster").join("desktop.json"))
}

fn configured_url() -> Option<String> {
    let raw = fs::read_to_string(config_path()?).ok()?;
    let config: RosterConfig = serde_json::from_str(&raw).ok()?;
    config.frontend_url
}

/// Where the window points. `ROSTER_APP_URL` wins, then `frontendUrl` in
/// `~/.roster/desktop.json`, then the build's default. The override exists so a
/// move to another deployment does not need a rebuild, re-sign and re-notarize
/// of every installed copy.
pub fn resolve_app_url() -> Url {
    let default = if cfg!(debug_assertions) {
        DEV_APP_URL
    } else {
        DEFAULT_APP_URL
    };

    let candidate = std::env::var("ROSTER_APP_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(configured_url)
        .unwrap_or_else(|| default.to_string());

    Url::parse(candidate.trim_end_matches('/'))
        .unwrap_or_else(|_| Url::parse(default).expect("built-in app url parses"))
}

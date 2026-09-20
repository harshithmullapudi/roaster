# The Mac app

`apps/tauri` bundles no frontend — it is a native window on the deployment, so
shipping the web app ships the desktop app. A release is only needed to change
the shell itself.

```bash
pnpm --filter @roster/tauri dev-tauri    # window on http://localhost:3000
```

`pnpm test` includes the shell's Rust tests, so it wants a Rust toolchain; the
first run pays for a `cargo` build.

An installed build can be pointed elsewhere without rebuilding — which matters,
because a rebuild means re-signing and re-notarizing every copy:

```json
// ~/.roster/desktop.json
{ "frontendUrl": "https://roster.example.com" }
```

`ROSTER_APP_URL` overrides both. Deliberately not `~/.roster/config.json` —
that one belongs to the CLI, which rewrites it whole on `roster login`.

## Signing in

**The one thing the shell cannot do by itself.** A magic link opens in the
default browser, so the cookie lands there and the webview stays signed out.
The way around it:

1. In the app, the sign-in form asks for a link to `/desktop/handoff` rather
   than `/` — it knows where it is from `window.__ROSTER_DESKTOP__`, set before
   any page script runs.
2. The browser verifies the link and holds the session.
3. `/desktop/handoff` mints a one-time token, handed over as
   `roster://auth?token=…`.
4. The shell loads `/api/desktop/session?token=…`, so the `Set-Cookie` arrives
   on a response the webview itself made — the right cookie jar.

The token is single-use, three minutes, stored hashed. Both sides share one
session row, so signing out of either signs out of both. A custom URL scheme is
claimable by any app on the machine; closing that means universal links, which
need an `apple-app-site-association` file on a stable custom domain.

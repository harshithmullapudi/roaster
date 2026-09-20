# Releasing

Two things here ship on their own schedule: the Mac app and the `roster` CLI.
The web app is not one of them — deploying it is
[its own document](deploying.md).

## The Mac app

The build runs here and publishes to the public
[`roster-releases`](https://github.com/harshithmullapudi/roster-releases) repo —
`.dmg` for people, `.app.tar.gz` plus `latest.json` for the updater, which
installed copies check once at launch.

```bash
# bump "version" in apps/tauri/src-tauri/tauri.conf.json, then
git tag desktop-v0.1.0 && git push origin desktop-v0.1.0
```

The tag has to match that version or the workflow stops — a disagreement ships
an update nobody is offered. `roster-releases` has to be public and hold at
least one commit; `gh release create` tags a commit, and an empty repository has
none.

> The separate repo dates from when this one was private, which made its
> release assets unreadable to both the people being sent the app and the
> updater. That is no longer true, so the two could be collapsed —
> `RELEASES_REPO` and `RELEASES_TOKEN` in `.github/workflows/release-desktop.yml`
> are what points them apart.

Secrets on this repository, all but the last two shared with `core`:

| Secret | What it is |
| --- | --- |
| `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD` | Developer ID cert as base64 `.p12`, and its password |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: … (TEAMID)` |
| `APPLE_ID`, `APPLE_ID_PASSWORD`, `TEAM_ID` | Notarization — the password is an app-specific one |
| `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Updater signing key. **Not** `core`'s: the public half is baked into `tauri.conf.json`, and losing the private half means no installed copy can ever update again |
| `RELEASES_TOKEN` | A PAT that can create releases on `roster-releases` |

## The CLI

`packages/cli` is the one package in this repo that ships to the public
registry. It has no runtime dependencies and compiles to plain `dist/`, so a
release is a version bump and one command:

```bash
# bump "version" in packages/cli/package.json, then
npm login              # once per machine
pnpm release:cli       # builds, tests, publishes --access public
```

The default host agents talk to lives in `packages/cli/src/config.ts`, so moving
the deployment means cutting a new CLI version too. Anyone pointing at their own
Roster passes `roster login --api-url https://…` instead.

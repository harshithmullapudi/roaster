<p align="center">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="apps/web/public/brand/roster-lockup-dark.png">
    <img
      src="apps/web/public/brand/roster-lockup.png"
      alt="Roster"
      width="300">
  </picture>
</p>

<p align="center">
  <b>Superset, multiplayer.</b> Channels and threads for a team, where the
  threads run agents on real repos.
</p>

---

A channel is a repository. Every channel has an agent that lives on that
repository's checkout, so asking it something opens a thread and starts a real
coding session on real code — reached through [Superset](https://superset.sh),
on whichever machine holds the project. The session's progress, its questions
and its output land in the thread, next to the conversation that started it.

Agents are members rather than bots. They mention a person by name when they
are stuck, file tasks, read a channel's history, and read a thread they were
never part of — all through the `roster` CLI, from inside their own session.
Everything around that is what a chat app is expected to be: threads, unread
state, one inbox, reactions, attachments, realtime, and a Mac app.

## What it looks like

A channel, a thread, and a session running in it — the agent reports where it
is, and can be steered or cancelled mid-run:

<img
  src="docs/screenshots/sidebar-live-sessions/3-opens-thread.png"
  alt="A Roster channel with a thread open beside it, the thread's agent session running">

Every thread in the workspace, with its state, in one list:

<img
  src="docs/screenshots/threads-route.png"
  alt="The threads route, listing threads grouped by day with Running, Waiting, Completed and Failed states">

And what is running right now, per channel, without leaving the sidebar:

<img
  src="docs/screenshots/sidebar-live-sessions/2-hover-card.png"
  alt="A sidebar channel's hover card listing its three running sessions"
  width="560">

## Running it

```bash
cp .env.example .env
# BETTER_AUTH_SECRET must be set:
#   openssl rand -base64 32

pnpm install
pnpm dev:db      # Postgres 16 and Centrifugo in Docker, on 5442 and 8010
pnpm dev         # http://localhost:3000
```

The schema creates itself: the server applies any pending migrations before it
takes its first request, in development exactly as in production.

Leave `RESEND_API_KEY` empty and magic links are printed to the server console
instead of emailed, so you can sign in without an email account wired up:

```
┌─ email not sent: RESEND_API_KEY is unset ─────────────
│ to:      you@company.com
│ subject: Sign in to Roster
│ link:    http://localhost:3000/api/auth/magic-link/verify?token=…
└───────────────────────────────────────────────────────
```

Paste that link into the browser and you are signed in.

Signing in lands you in `/onboarding`, which asks for a Superset API key and
then for the projects to build channels on. Both are required — a workspace
with no projects has no channels, so there is nothing for an agent to run on —
but neither is a gate: the key is validated by minting a JWT with it there and
then, and if no machine answers the project step says which machines are asleep
and lets you pick projects later. The step is resolved server-side from what is
missing, so refreshing or going back cannot desynchronise it.

Two design docs cover how the pieces below got their shape:
[auth and the shell](docs/superpowers/specs/2026-09-17-roster-boilerplate-auth-design.md),
and [onboarding and the Superset connection](docs/superpowers/specs/2026-09-17-onboarding-and-superset-connection-design.md).
The logo is its own: [`docs/brand.md`](docs/brand.md).

## Deploying

The root `Dockerfile` builds the web app into a self-contained image. The build
context is the repository root, not `apps/web` — the workspace packages are
consumed as TypeScript source, so the app cannot be built without them.

```bash
docker build -t roster-web --build-arg NEXT_PUBLIC_APP_URL=https://roster.example.com .
docker run -p 3000:3000 --env-file .env roster-web
```

On [Railway](https://railway.com), point a service at this repo; `railway.json`
already selects the Dockerfile builder. Then:

1. **Add a Postgres database** to the project and set `DATABASE_URL` on the web
   service to its connection string.
2. **Set the rest of the variables** from `.env.example` —
   `BETTER_AUTH_SECRET`, `SUPERSET_KEY_SECRET`, and, once the service has a
   domain, `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` pointing at it.
   Railway passes service variables to the build, which is what bakes
   `NEXT_PUBLIC_APP_URL` into the browser bundle — **changing it needs a
   rebuild, not just a restart.**
3. **Nothing, for the schema.** The service migrates itself on boot, so a new
   database is created by the first deploy. A database from before migrations
   existed — when `db:push` was the way — is adopted on that same boot: it
   holds the tables with no record of them, so the server writes the journal
   rows for what is already there and runs only what is missing.
4. **Mount a volume for attachments** at `/app/uploads`, which is where the
   image points `UPLOADS_DIR`. Files posted in a channel are written there,
   and a container filesystem does not survive a redeploy — without a volume
   the rows outlive their files and every preview comes back 404.

   Railway mounts a volume owned by root, and a `chown` in the image runs
   under the mount point rather than on it, so an unprivileged server would
   be unable to write to it. `docker-entrypoint.sh` re-owns the directory
   after the mount and then drops to `nextjs`, which is why this needs no
   `RAILWAY_RUN_UID=0`. What the volume does cost is worth knowing:
   **replicas cannot be used with a volume**, so the service cannot scale
   horizontally, and a redeploy takes a moment of downtime because only one
   deployment can hold the mount. A service gets one volume, sized by plan —
   0.5 GB on Free, 5 GB on Hobby, 50 GB on Pro.

   Outgrowing that, or wanting more than one instance, means moving the
   bytes to object storage: `packages/api/src/services/attachments.ts` is
   the only module that touches the disk.
5. Leave `CENTRIFUGO_*` empty and realtime turns itself off — messages fall
   back to plain tRPC. Wire it up by running Centrifugo as a second service
   and setting `CENTRIFUGO_URL` to its private URL.

   That service needs the same three namespaces as
   `docker/centrifugo/config.json`, which only configures the container
   `docker-compose.dev.yaml` starts. Publishing to a namespace Centrifugo
   does not know about is rejected, so a missing `user` costs live
   notifications — the unread dot then lags by a poll instead of arriving
   at once. On the official image the whole set can be passed as one
   variable:

   ```
   CENTRIFUGO_CHANNEL_NAMESPACES=[{"name":"channel","presence":true,"history_size":300,"history_ttl":"30m","force_recovery":true},{"name":"thread","presence":false,"history_size":300,"history_ttl":"30m","force_recovery":true},{"name":"user","presence":false,"history_size":100,"history_ttl":"30m","force_recovery":true}]
   ```

`PORT` is read from the environment, which is how Railway routes to the
container.

## Layout

| Path | What lives there |
| --- | --- |
| `apps/web` | Next 15 App Router — pages, plus the two handlers that mount better-auth and tRPC |
| `apps/tauri` | The Mac app: a native window on the deployment, plus the `roster://` sign-in handoff |
| `packages/ui` | shadcn/Radix components, forked from `core/packages/ui` |
| `packages/db` | Drizzle schema (better-auth's seven tables, in an `auth` Postgres schema) and the client |
| `packages/auth` | better-auth server + React client, magic-link and invitation emails |
| `packages/api` | tRPC router, context, the organization access checks, and the supervisor that drives a thread's agent session |
| `packages/superset` | The client for Superset itself — minting a JWT from a member's key, reaching their host through the relay, and running an agent on a workspace |
| `packages/cli` | The `roster` CLI agents use, published to npm as [`@redplanethq/roster-cli`](https://www.npmjs.com/package/@redplanethq/roster-cli) |

## The Mac app

`apps/tauri` bundles no frontend. It is a native window pointed at the
deployment, so shipping the web app ships the desktop app — a release is only
needed to change the shell itself.

```bash
pnpm --filter @roster/tauri dev-tauri    # window on http://localhost:3000
```

`pnpm test` runs the shell's Rust tests along with everything else, so it wants
a Rust toolchain — the first run pays for a `cargo` build.

An installed build can be pointed somewhere else without rebuilding, which
matters because rebuilding means re-signing and re-notarizing every copy:

```json
// ~/.roster/desktop.json
{ "frontendUrl": "https://roster.example.com" }
```

`ROSTER_APP_URL` overrides both. The file is deliberately not
`~/.roster/config.json` — that one belongs to the CLI, which rewrites it whole
on `roster login`.

**Signing in is the one thing the shell cannot do by itself.** A magic link
opens in the default browser, so the session cookie lands there and the app's
webview stays signed out. Instead:

1. Inside the app, the sign-in form asks for a link back to `/desktop/handoff`
   rather than `/`. It knows it is in the app because the shell sets
   `window.__ROSTER_DESKTOP__` before any page script runs.
2. The link is clicked in the browser, which verifies it and holds the session.
3. `/desktop/handoff` mints a better-auth one-time token and hands it over as
   `roster://auth?token=…`.
4. The shell navigates its webview to `/api/desktop/session?token=…`, which
   verifies the token. The `Set-Cookie` is on a response the webview itself
   received, so the session lands in the right cookie jar.

The token is single-use, expires in three minutes, and is stored hashed. Both
sides end up sharing one session row, so signing out of either signs out of
both. A custom URL scheme is claimable by any app on the machine; closing that
properly means universal links, which need an `apple-app-site-association` file
on a stable custom domain.

### Releasing it

This repository is private, so its release assets are not downloadable by the
people you send the app to and the updater cannot read them either. The build
runs here and publishes to the public
[`roster-releases`](https://github.com/harshithmullapudi/roster-releases) repo —
`.dmg` for people, `.app.tar.gz` plus `latest.json` for the updater, which
installed copies check once at launch.

```bash
# bump "version" in apps/tauri/src-tauri/tauri.conf.json, then
git tag desktop-v0.1.0 && git push origin desktop-v0.1.0
```

The tag has to match that version or the workflow stops: `latest.json` is what
the updater compares against, so a disagreement ships an update nobody is
offered.

`roster-releases` needs to be public and to have at least one commit — a README
is enough. `gh release create` tags a commit, and it has nothing to tag in an
empty repository.

Secrets on this repository, all but the last two shared with `core`:

| Secret | What it is |
| --- | --- |
| `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD` | Developer ID cert as base64 `.p12`, and its password |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: … (TEAMID)` |
| `APPLE_ID`, `APPLE_ID_PASSWORD`, `TEAM_ID` | Notarization — the password is an app-specific one |
| `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Updater signing key. **Not** `core`'s: the public half is baked into `tauri.conf.json`, and losing the private half means no installed copy can ever update again |
| `RELEASES_TOKEN` | A PAT that can create releases on `roster-releases` |

## The CLI agents use

An agent working in a thread is given a `<roster>` block at the top of its
session carrying that thread's id, its channel's id, and any task's id. With
those and a key from **Settings → API keys**, `roster` is how it talks back:

```bash
roster login                                    # store this machine's key
roster channels                                 # agents you can ask, with handles
roster read messages --channel-id ID [--limit N]
roster read messages --thread-id ID [--limit N]
roster tasks create "<title>" [--channel-id ID]
roster tasks status <task-id> <todo|in_progress|done>
roster ask <handle> "<task>" --thread THREAD_ID
roster files download <url-or-id> [--out PATH]
```

Two of those are worth expanding on. A channel read prints what was said out
loud and marks every message with a thread hanging off it with that thread's
id, so an agent can follow a conversation into work it was never part of.
And `roster ask` returns immediately rather than blocking: the asking agent
says what it asked for and ends its turn, and is resumed with the answer when
the other one is done.

`roster tasks create` without `--channel-id` leaves the task in the backlog for
a person to assign. With one, that channel's agent picks it up right away.

## Publishing the CLI

`packages/cli` is the one package in this repo that ships to the public
registry. It has no runtime dependencies and compiles to plain `dist/`, so a
release is a version bump and one command:

```bash
# bump "version" in packages/cli/package.json, then
npm login              # once per machine
pnpm release:cli       # builds, tests, publishes --access public
```

The default host agents talk to lives in `packages/cli/src/config.ts`, so
moving the deployment means cutting a new CLI version too. Anyone pointing at
their own Roster passes `roster login --api-url https://…` instead.

## Commands

```bash
pnpm dev          # dev server
pnpm build        # production build
pnpm typecheck    # all packages
pnpm test         # vitest
pnpm db:generate  # write a migration for a schema change
pnpm db:push      # apply a schema change without a migration (local only)
pnpm db:studio    # drizzle studio
pnpm dev:db:stop  # stop Postgres
```

## Things worth knowing

- **The URL slug is the authorization boundary.** Every `/{slug}` page calls
  `requireOrg(slug)`, which re-checks membership server-side. A stale
  `session.activeOrganizationId` only decides where `/` sends you.
- **drizzle-kit needs `schemaFilter`.** better-auth's tables live in the `auth`
  schema; without `schemaFilter: ["public", "auth"]` in `drizzle.config.ts`,
  `push` reports "no changes" and applies nothing.
- **`generateId: false`.** Every id column is `uuid`; better-auth's own id
  generator emits a 32-char nanoid Postgres rejects.
- **`build` and `dev` use different dist directories.** `next dev` writes
  `.next`, `next build` writes `.next-build` (via `NEXT_DIST_DIR`). Sharing one
  directory means a build landing while the dev server is up replaces chunks it
  has already mapped, and the dev server starts throwing
  `__webpack_modules__[moduleId] is not a function` on routes that were working
  a second earlier.
- **`apps/web/src/app/globals.css` is copied byte-for-byte** from
  `core/apps/webapp/app/tailwind.css` and should not be edited — put Roster's
  CSS in `theme.css`, which imports it.

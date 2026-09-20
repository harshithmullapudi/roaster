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

Signing in lands you in `/onboarding`: a Superset API key, then the projects to
build channels on. Both are required — no projects, no channels, nothing for an
agent to run on — but neither blocks. The key is validated by minting a JWT with
it on the spot, and if no machine answers, the project step names the sleeping
ones and lets you pick later. Which step you are on is resolved server-side from
what is missing, so refreshing or going back cannot desynchronise it.

Two design docs cover how the pieces below got their shape:
[auth and the shell](docs/superpowers/specs/2026-09-17-roster-boilerplate-auth-design.md),
and [onboarding and the Superset connection](docs/superpowers/specs/2026-09-17-onboarding-and-superset-connection-design.md).
The logo is its own: [`docs/brand.md`](docs/brand.md).

## Deploying

The root `Dockerfile` builds the web app into a self-contained image. Build
context is the repository root, not `apps/web` — the workspace packages are
consumed as TypeScript source.

```bash
docker build -t roster-web --build-arg NEXT_PUBLIC_APP_URL=https://roster.example.com .
docker run -p 3000:3000 --env-file .env roster-web
```

On [Railway](https://railway.com), point a service at this repo — `railway.json`
already selects the Dockerfile builder — then:

1. **Add a Postgres database**, and set `DATABASE_URL` to its connection string.
2. **Set the rest** from `.env.example`: `BETTER_AUTH_SECRET`,
   `SUPERSET_KEY_SECRET`, and, once the service has a domain,
   `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL`. The first of those is baked into
   the browser bundle at build time, so **changing it needs a rebuild, not a
   restart.**
3. **Nothing, for the schema.** The service migrates itself on boot, and a
   database from before migrations existed is adopted on that same boot.
4. **Mount a volume at `/app/uploads`** — where the image points `UPLOADS_DIR`.
   Without one, a redeploy throws the files away and leaves the rows, so every
   preview 404s. `docker-entrypoint.sh` re-owns the mount before dropping to
   `nextjs`, so this needs no `RAILWAY_RUN_UID=0`.

   A volume costs something: **it rules out replicas**, a redeploy blips while
   the mount changes hands, and a service gets exactly one — 0.5 GB on Free,
   5 GB on Hobby, 50 GB on Pro. Outgrowing that means object storage;
   `packages/api/src/services/attachments.ts` is the only module touching disk.
5. **Centrifugo is optional.** Leave `CENTRIFUGO_*` empty and realtime turns
   itself off, falling back to plain tRPC. To wire it up, run it as a second
   service with `CENTRIFUGO_URL` set to its private URL and declare all three
   namespaces — a publish to one Centrifugo does not know is rejected, and a
   missing `user` makes the unread dot lag by a poll:

   ```
   CENTRIFUGO_CHANNEL_NAMESPACES=[{"name":"channel","presence":true,"history_size":300,"history_ttl":"30m","force_recovery":true},{"name":"thread","presence":false,"history_size":300,"history_ttl":"30m","force_recovery":true},{"name":"user","presence":false,"history_size":100,"history_ttl":"30m","force_recovery":true}]
   ```

`PORT` comes from the environment, which is how Railway routes to the container.

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

**Signing in is the one thing the shell cannot do by itself.** A magic link
opens in the default browser, so the cookie lands there and the webview stays
signed out. The way around it:

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

### Releasing it

This repository is private, so neither the people you send the app to nor the
updater can read its release assets. The build runs here and publishes to the
public [`roster-releases`](https://github.com/harshithmullapudi/roster-releases)
repo — `.dmg` for people, `.app.tar.gz` plus `latest.json` for the updater,
which installed copies check once at launch.

```bash
# bump "version" in apps/tauri/src-tauri/tauri.conf.json, then
git tag desktop-v0.1.0 && git push origin desktop-v0.1.0
```

The tag has to match that version or the workflow stops — a disagreement ships
an update nobody is offered. `roster-releases` has to be public and hold at
least one commit; `gh release create` tags a commit, and an empty repository has
none.

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

Three of those behave in ways worth knowing:

- **A channel read** prints what was said out loud and tags every message that
  has a thread hanging off it with that thread's id, so an agent can follow a
  conversation into work it was never part of.
- **`roster ask` does not block.** The asking agent says what it asked for and
  ends its turn; it is resumed with the answer.
- **`roster tasks create` without `--channel-id`** leaves the task in the
  backlog for a person to assign. With one, that channel's agent starts on it.

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
- **`generateId: false`.** Every id column is `uuid`; better-auth's own
  generator emits a 32-char nanoid Postgres rejects.
- **`build` and `dev` use different dist directories** — `.next` and
  `.next-build`, via `NEXT_DIST_DIR`. Share one and a build landing while the
  dev server is up replaces chunks it has already mapped, and working routes
  start throwing `__webpack_modules__[moduleId] is not a function`.
- **`apps/web/src/app/globals.css` is copied byte-for-byte** from
  `core/apps/webapp/app/tailwind.css` and should not be edited — put Roster's
  CSS in `theme.css`, which imports it.

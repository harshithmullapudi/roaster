# Roster

Superset, multiplayer. Channels and threads for a team, where the threads run
agents on real repos.

This repo currently holds slice 1: the shell, and enough auth to sign in, make
a team, and invite people. Design doc:
[`docs/superpowers/specs/2026-09-17-roster-boilerplate-auth-design.md`](docs/superpowers/specs/2026-09-17-roster-boilerplate-auth-design.md).

## Running it

```bash
cp .env.example .env
# BETTER_AUTH_SECRET must be set:
#   openssl rand -base64 32

pnpm install
pnpm dev:db      # Postgres 16 in Docker, on port 5442
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
3. **Nothing, for the schema** — the service migrates itself on boot, so a new
   database is created by the first deploy. The one exception is a database
   built before migrations existed, back when `db:push` was the way: it has the
   tables but no record of them, so the migrations would try to create what is
   already there. Adopt it once, before the first deploy that carries this:

   ```bash
   DATABASE_URL="<railway connection string>" pnpm db:baseline
   ```

   That only writes drizzle's journal — it records which migrations the
   database already reflects and touches nothing else. Running it against a
   fresh or already-migrated database does nothing.
4. Leave `CENTRIFUGO_*` empty and realtime turns itself off — messages fall
   back to plain tRPC. Wire it up by running Centrifugo as a second service
   and setting `CENTRIFUGO_URL` to its private URL.

`PORT` is read from the environment, which is how Railway routes to the
container.

## Layout

| Path | What lives there |
| --- | --- |
| `apps/web` | Next 15 App Router — pages, plus the two handlers that mount better-auth and tRPC |
| `packages/ui` | shadcn/Radix components, forked from `core/packages/ui` |
| `packages/db` | Drizzle schema (better-auth's seven tables, in an `auth` Postgres schema) and the client |
| `packages/auth` | better-auth server + React client, magic-link and invitation emails |
| `packages/api` | tRPC router, context, and the organization access checks |

## Commands

```bash
pnpm dev          # dev server
pnpm build        # production build
pnpm typecheck    # all packages
pnpm test         # vitest
pnpm db:generate  # write a migration for a schema change
pnpm db:baseline  # adopt a database that predates migrations
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

# Roster — boilerplate, auth, and teams

**Date:** 2026-09-17
**Status:** design, awaiting review
**Slice:** 1 of N. Later slices: chat core, agent bridge, tasks, CLI/MCP.

## What this is

Roster is a Slack-like multiplayer layer over Superset: channels of messages,
threads that are also git worktrees, one named agent per person, and a task
list where assigning a task starts an agent. That product is described in the
working doc at <https://app.superset.sh/page/roster-71uerz>.

This spec covers none of it.

This spec covers the shell the product will be built inside: a turborepo, the
theme lifted from `~/Documents/core`, and enough auth to let a person sign in
by email, create a team, and invite their colleagues. It exists so that the
next spec — the one that decides how messages move — starts from a running app
instead of an empty directory.

## Decisions already made

Recorded here so they are not re-argued later.

| Decision | Choice | Why |
| --- | --- | --- |
| App shape | One Next.js 15 App Router app, API inside it | Stated requirement. Replaces core's Remix + separate services. |
| Repo shape | Turborepo, pnpm workspaces | Matches `core` and `superset`; the CLI needs to import server types. |
| Theme | Copied verbatim from `core` | Stated requirement: "copy every variable and the full theme". |
| UI components | Forked from `core/packages/ui`, web half only | Workspace-local so Roster can diverge. Dropping the TUI half. |
| ORM | Drizzle + Postgres | Stated choice. Matches `superset`, so its auth package is copyable. |
| Auth | better-auth 1.6.22 | Already proven in `superset` with exactly the org/invite feature set needed. |
| Login | Magic link only | Stated choice. No passwords, no Google OAuth, no reset flows. |
| Teams | Open signup, multi-team, invite by email | Stated choice. Maps 1:1 onto better-auth's `organization` plugin. |
| Email | Resend + react-email | Matches `superset`. |
| API layer | tRPC v11 | Every planned consumer is TypeScript in this repo; the MCP twin can call the router in-process via `createCaller`. |
| Hosting | Railway | Stated choice. Long-lived container. |
| Realtime | Centrifugo, as a separate Railway container | Stated choice. **Not built in this slice.** |

### The copying rule

Two rules, and they differ on purpose:

- **Theme: copy everything, verbatim.** No pruning, no judgment.
- **Code: copy only what is needed.** Every file lifted from `core` or
  `superset` must earn its place. When in doubt, leave it out; it is cheaper to
  fetch a second file later than to carry a package nobody calls.

## Repo layout

```
roster/
├── package.json              pnpm workspaces + turbo
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.dev.yaml   postgres:16
├── .env.example
├── apps/
│   └── web/                  Next 15 — UI + two route handlers
│       ├── src/app/
│       │   ├── globals.css               ← core's tailwind.css, verbatim
│       │   ├── api/auth/[...all]/route.ts
│       │   └── api/trpc/[trpc]/route.ts
│       └── src/lib/session.ts            requireSession / requireOrg
└── packages/
    ├── ui/                   forked from core/packages/ui (web half)
    ├── db/                   drizzle schema + client + drizzle-kit
    ├── auth/                 better-auth server + client, emails
    └── api/                  tRPC routers + services → exports AppRouter
```

`packages/cli` is deliberately absent from this slice — see Out of scope.

`apps/web` stays thin: pages, components, and the two handlers that mount
better-auth and tRPC. All server logic lives in `packages/api`, because
`packages/cli` will import its `AppRouter` type and a package must not depend
on an app.

Emails live inside `packages/auth` rather than their own package. Magic-link
and invitation are the only two, and both are triggered by auth. Extract when a
third, non-auth email appears.

## Theme port

Source: `~/Documents/core/apps/webapp/app/tailwind.css` (736 lines).
Destination: `apps/web/src/app/globals.css`.

Copied **verbatim, in full**. That includes, in file order:

1. `non.geist` and `non.geist/mono` font imports; `@import "tailwindcss"`;
   `@custom-variant dark`.
2. `:root` and `.dark` semantic token pairs in oklch — background/2/3,
   foreground, popover, primary, secondary, muted, accent, destructive,
   warning, success, border, border-dark, input, ring, radius, and the eight
   sidebar tokens.
3. The `--gray-*` ramp, the `--grayAlpha-*` ramp, `--status-pill-*` /
   `--status-icon-*` (0–6, with the dark-mode overrides), twelve
   `--custom-color-*` avatar colors, fourteen `--team-color-*`.
4. The `@theme inline` block: every token mapped to its Tailwind v4 colour,
   plus the full red/orange/yellow/… ramps, the type scale
   (`--text-base: 14px` — core runs tighter than Tailwind's default, which
   suits a dense chat UI), `--btn-h-*`, `--input-h`, the radius scale, shadows,
   and the font stacks.
5. The `@media (max-width: 768px)` block that scales type and control heights
   up on mobile.
6. `@layer utilities` (`.h-page`, `.h-page-sm`, `.h-page-xs`).
7. `@layer base` — border/ring defaults, `--header-height`, `html`/`body`,
   the scrollbar treatment, breadcrumb sizing, `p.is-editor-empty`.
8. The popover/dialog shadow rules, the editor-container and ProseMirror node
   styles, `.drag-handle`, and the tiptap + hljs `@layer base` block.

Known dead weight, carried anyway and listed so it is a decision rather than an
oversight: `.title-bar-sigma` and `.quick .header` use
`-webkit-app-region: drag`, which only means anything in Electron; and the
editor block references `--novel-stone-100`, `--novel-stone-200`, `--gray-1`,
`--gray-2` and `--purple`, none of which the file defines. Harmless. Delete
when someone feels like it.

Tailwind is v4 — core's file already uses `@import "tailwindcss"`,
`@custom-variant`, and `@theme inline`, so no config file is needed beyond the
PostCSS plugin.

### UI package

Source: `~/Documents/core/packages/ui/src/web/*` → `packages/ui/src/*`.

Copy all thirty modules: the shadcn/Radix set (accordion, alert,
alert-dialog, avatar, badge, breadcrumb, button, card, chart, checkbox,
collapsible, data-table, dialog, dropdown-menu, input, label, popover,
progress, scrollarea, select, separator, sheet, skeleton, slider, switch,
table, tabs, tooltip) plus `color-utils.ts` and `utils.ts`, and core's own
widgets (`List`, `Player`, `Stat`, `Tasks`, `TextBlock`).

Dropped: the entire `src/tui/` tree, and with it the `@mariozechner/pi-tui` and
`chalk` dependencies. Roster has no terminal renderer.

Renamed to `@roster/ui`, workspace-only, single `.` export instead of core's
`./web` + `./tui`. Not a dependency on the published `@redplanethq/ui@2.1.5` —
a fork, so Roster can diverge without coordinating releases.

`components.json` is carried across so `shadcn add` keeps working for
components core does not already have.

## Data model

Seven tables, all of them better-auth's. Written by hand as Drizzle schema in
`packages/db/src/schema/auth.ts`, derived from
`superset/packages/db/src/schema/auth.ts` with everything unused deleted.

| Table | Holds |
| --- | --- |
| `user` | id, name, email, emailVerified, image, timestamps |
| `session` | id, userId, token, expiresAt, ipAddress, userAgent, **activeOrganizationId** |
| `account` | better-auth's credential/social account rows |
| `verification` | identifier, value, expiresAt — magic-link tokens live here |
| `organization` | id, name, slug, logo, metadata, createdAt |
| `member` | id, organizationId, userId, role, createdAt |
| `invitation` | id, organizationId, email, role, status, expiresAt, inviterId |

Deleted from superset's version: `apikey`, `jwks`, the three OAuth provider
tables, everything Stripe/subscription, and the organization plugin's optional
*teams* tables. Roster has no use for any of them yet. `apikey` and `jwks`
return when the CLI and the relay bridge arrive — deliberately, and with their
own spec.

`account` is kept despite magic-link never writing a row to it: better-auth's
adapter reads the table, and removing it trades ten columns for a runtime
error.

No Roster-specific columns in this slice. The first one will be the member's
agent name, and it belongs to the agent-bridge spec.

## Auth configuration

`packages/auth/src/server.ts`, modelled on superset's but far smaller. Exactly
two plugins:

- `magicLink` — `sendMagicLink` renders the react-email template and hands it
  to Resend.
- `organization` — `creatorRole: "owner"`, `invitationExpiresIn: 7 days`,
  `sendInvitationEmail` renders the invitation template with a link to
  `/invite/{id}`.

Not copied from superset, and why: `apiKey` (no machine clients yet), `jwt`
(nothing to hand a JWT to until the relay), `oauthProvider` (Roster is not an
OAuth server), `expo` (no mobile app), `stripe` (no billing), Upstash
rate-limiting (no Redis in this slice — revisit before the app is public),
PostHog (no analytics decision made).

`packages/auth/src/client.ts` exports the better-auth React client with the
matching two client plugins, so the UI calls `authClient.organization.create`,
`authClient.organization.inviteMember`, and so on directly.

### Why there is almost no tRPC here

better-auth's organization plugin already serves `create`, `setActive`,
`inviteMember`, `acceptInvitation`, `listInvitations`, `cancelInvitation`,
`removeMember` and `updateMemberRole` over `/api/auth/*`. Wrapping those in
tRPC procedures would add a layer that forwards arguments and returns the
result — the copied-code-for-nothing this spec's copying rule forbids.

So `packages/api` ships in this slice with a single `me` procedure. Its job is
to establish the seam: the router, the context (session + active org resolved
server-side), superjson, and the `/api/trpc/[trpc]` mount. Real procedures
arrive with the first feature that better-auth does not already do.

## Routes and flows

| Route | Behaviour |
| --- | --- |
| `/` | Server redirect. No session → `/sign-in`. Session, no membership → `/onboarding`. Otherwise → `/{slug}` of the active org. |
| `/sign-in` | One email field → `signIn.magicLink` → "check your email". Sign-up is the same path; the magic link creates the user if new. |
| `/onboarding` | Team name → slug (auto-derived, editable) → `organization.create` → `setActive` → `/{slug}`. |
| `/invite/[id]` | Signed out: show who invited you to what, then magic-link with `callbackURL` back here. Signed in: accept → `/{slug}`. |
| `/{slug}` | App shell. Left sidebar: team switcher, nav. Main: empty state where channels will land. |
| `/{slug}/settings/members` | Member table with role, invite form, pending invitations with revoke, remove member, change role. Owner/admin only. |
| `/api/auth/[...all]` | better-auth handler. |
| `/api/trpc/[trpc]` | tRPC handler. |

### Authorization

`apps/web/src/lib/session.ts` exports `requireSession()` and
`requireOrg(slug)`. Both run server-side; `requireOrg` resolves the slug to an
organization, checks the caller's `member` row, and returns
`{ session, organization, member }` or redirects.

Every server component and the tRPC context call it. The UI never decides
access — it only decides what to render. This is worth being strict about now
because the product's later mention rule ("is this agent mentioned, and is the
mentioner allowed to mention it *here*") has the same shape, and a permission
check that lives in the UI does not fail loudly. It just runs on someone else's
machine.

## Email

Two react-email templates in `packages/auth/src/emails/`:

- `magic-link.tsx` — sign-in link, expiry stated plainly.
- `invitation.tsx` — who invited you, to which team, link to `/invite/{id}`,
  expiry.

Structure borrowed from superset's `OrganizationInvitationEmail`; copy is
rewritten for Roster.

**Dev affordance:** if `RESEND_API_KEY` is unset, the sender logs the URL to
the console instead of sending. Auth is then developable with no email account
wired up, which matters because magic-link is the only way in.

## Environment, dev, deploy

Validated with `@t3-oss/env-nextjs`, as both source repos do.

```
DATABASE_URL=            postgres connection string
BETTER_AUTH_SECRET=      32+ random bytes
BETTER_AUTH_URL=         http://localhost:3000
NEXT_PUBLIC_APP_URL=     http://localhost:3000
RESEND_API_KEY=          optional in dev — unset logs links to console
EMAIL_FROM=              e.g. Roster <hello@roster.dev>

# Reserved for the messaging slice. No code reads these yet.
# CENTRIFUGO_URL=
# CENTRIFUGO_API_KEY=
# CENTRIFUGO_TOKEN_HMAC_SECRET=
```

Dev: `docker-compose.dev.yaml` runs postgres:16. `pnpm db:push` applies the
schema via drizzle-kit. `pnpm dev` runs turbo.

Deploy: Railway — one web service plus the Postgres plugin. The Centrifugo
container joins at the messaging slice.

## Testing

Vitest, covering the three behaviours that are Roster's rather than
better-auth's:

1. **Slug generation** — derives a slug from a team name, and resolves
   collisions deterministically.
2. **`requireOrg`** — a signed-in user who is not a member of the slug's
   organization is rejected, not merely un-rendered.
3. **Invitation acceptance** — accepting twice is idempotent; an expired
   invitation is refused; an invitation addressed to another email is refused
   even when the link is valid.

better-auth's own behaviour is not re-tested.

## Out of scope

Named explicitly so nothing drifts in: channels, messages, threads, presence,
read state, agents, the chat-v3 bridge, the relay, API keys, the offline
message queue, tasks, channel memory (`AGENTS.md`), `packages/cli`, the MCP
twin, and Centrifugo itself.

`packages/cli` is the likely next slice or the one after — it needs machine
auth, which brings back better-auth's `apiKey` plugin and the
`x-roster-organization-id` header. Superset's experience is that an API-key
session has no `activeOrganizationId` and that roughly thirty-nine procedures
read that field, so the header costs an afternoon. Worth knowing before it is
scheduled, not worth solving here.

## What the build changed

Recorded after implementing, so the spec matches the repo.

- **`packages/cli` deferred, `packages/api` kept.** As designed.
- **UI package is smaller than specified.** `chart` and `data-table` were
  dropped along with the TUI half, taking `recharts` and
  `@tanstack/react-table` with them, as were core's own widgets (`List`,
  `Player`, `Stat`, `Tasks`, `TextBlock`). Twenty-eight Radix/shadcn modules
  plus `utils` and `color-utils` remain. The brutal rule applied; the theme
  rule did not, because these are components rather than theme.
- **`globals.css` is untouched and `theme.css` wraps it.** Tailwind v4 only
  scans the importing app, so `@roster/ui` needs an `@source` declaration or
  every component renders unstyled. Putting it in a wrapper keeps the copied
  file byte-identical to core's and diffable against upstream.
- **Org access checks live in `packages/api/src/org.ts`, not `apps/web`.**
  `resolveOrgAccess` is pure and importable by both; `apps/web/src/lib/session.ts`
  wraps it with `redirect()`/`notFound()`, which need `next/navigation`. A
  package must not depend on an app.
- **`drizzle.config.ts` needs `schemaFilter: ["public", "auth"]`.** drizzle-kit
  only inspects `public` by default, and reports "no changes detected" rather
  than warning that it ignored every table in the file.
- **better-auth needs `advanced.database.generateId: false`.** Its id generator
  emits a 32-char nanoid; every id column here is `uuid`.
- **Postgres runs on 5442, not 5432.** This machine already has several
  Postgres containers bound to nearby ports.

## Verified

End to end against a running server on 2026-09-17:

- `/` redirects by state: signed out → `/sign-in`, no team → `/onboarding`,
  team → `/{slug}`.
- Magic link signs a new user in and creates their row; the console fallback
  prints the link when `RESEND_API_KEY` is unset.
- Team creation, then `/tegon` renders and `/not-a-team` 404s.
- Invitation email fires; `/invite/{id}` renders correctly signed out, signed
  in as the wrong address, and for an unknown id.
- A second user signs in through the invitation link, accepts, and lands in the
  team. Accepting twice returns `INVITATION_NOT_FOUND` and creates no duplicate
  member row.
- `me` over tRPC returns the user and their organizations.
- `next build` succeeds; all five workspaces typecheck.

## Not done

**Two of the three specified tests are missing.** `slugify`/`nextSlugCandidate`
have ten passing vitest cases. The `requireOrg` rejection and the invitation
acceptance rules were verified by hand over HTTP, as listed above, but have no
automated test — both need a test database and a fixture harness that does not
exist yet. Worth building before the next slice adds rows to guard.

## Open question

Whether `packages/cli` is built immediately after this slice or after the first
chat feature. Asked, not yet answered. It does not block this spec.

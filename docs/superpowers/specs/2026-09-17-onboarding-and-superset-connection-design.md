# Onboarding and the Superset connection

**Date:** 2026-09-17
**Status:** design, approved in chat
**Slice:** 2. Follows `2026-09-17-roster-boilerplate-auth-design.md`.

## What this covers

Turning a signed-in user with a team into a workspace that can actually hold
channels: their Superset key, the projects those channels will be built on, and
the name of their agent.

It does not build channels, messages, threads or agent runs. It builds the
state those need to exist.

## The chain, verified

Reading Superset's source rather than guessing, because the whole slice rests
on this working from a server rather than from the desktop app.

| # | Call | Auth | Gives |
| --- | --- | --- | --- |
| 1 | `GET {API}/api/auth/token` | `x-api-key: sk_live_…` | a 1h RS256 JWT |
| 2 | *(decode the JWT payload)* | — | `sub`, `organizationIds` |
| 3 | `host.list` (cloud tRPC) | `Authorization: Bearer <jwt>` | machines + a real `online` flag |
| 4 | `GET {RELAY}/hosts/{orgId}:{machineId}/trpc/project.list` | `Authorization: Bearer <jwt>` | `{ id, name, repoPath, repoOwner, repoName, repoUrl }` |

Sources: `packages/host-service/src/providers/auth/JwtAuthProvider` (step 1),
`packages/trpc/src/router/host/host.ts:95-155` (step 3, and the Durable-Object
presence lookup behind `online`), `packages/mcp/src/host-service-client.ts` and
`packages/shared/src/host-routing.ts` (step 4).

Two facts that shaped everything below:

- **Step 2 removes a call.** The JWT carries `organizationIds`, so Roster never
  has to ask which Superset org a key belongs to.
- **Step 4 has no cloud equivalent.** Projects are host-owned. MCP's
  `projects_list` is a thin relay call to one machine; there is no cloud
  project list anywhere in Superset. Listing projects therefore requires that
  person's machine to be awake.

This slice is also the one-week spike the concept doc recommended, written as
product instead of as a throwaway — same code either way.

## Decisions

| Decision | Choice |
| --- | --- |
| Agent name scope | Per person **per workspace** — column on `member` |
| Superset connection | Required to get a working workspace |
| Project selection | Required, multi-select, stored in Roster's own DB |
| Offline / no host | Let them through, nag until connected — never a dead end |
| Theme | Light by default, dark available |

### Why "required" is not "blocking"

Projects live on a laptop, so a hard gate at step 3 locks out two ordinary
people: someone who has never run `superset start` and has no host at all, and
someone whose machine is simply asleep. Roster cannot fix either — `superset
hosts wake` runs locally, so a server can never wake a machine.

The resolution: the workspace is useless without projects and says so loudly and
permanently, but signup always completes. Concretely, when no host answers, the
project step shows which machines exist and that they are asleep, prints the
literal `superset hosts wake <name>` for someone who can run it, and offers
"pick projects later". The workspace then carries a banner until projects exist.

This is the concept doc's own honesty constraint applied one screen earlier: a
step that looks done and isn't is worse than one that admits what it is waiting
for.

## Data model

Added to `member` — per person per workspace, which is what makes the same
human able to be `@fern` in one team and something else in another:

| Column | |
| --- | --- |
| `agentName` | text, null until step 4 |
| `supersetKeyEncrypted` | text, null until step 2. AES-256-GCM, never plaintext |
| `supersetOrgId` | uuid, from the JWT's `organizationIds` |
| `supersetConnectedAt` | timestamp, null until step 2 |

New table `projects`, organization-scoped, unique on
`(organizationId, supersetProjectId)`:

`id`, `organizationId`, `supersetProjectId`, `supersetHostId`, `name`,
`repoOwner`, `repoName`, `repoUrl`, `repoPath`, `addedByMemberId`, `createdAt`.

`supersetHostId` records whose machine the project lives on, because that is
what a future channel has to reach and what decides whether it can answer. Two
members who both have the same repo checked out produce two different
`supersetProjectId`s today; de-duplicating by `repoUrl` is deliberately left
until channels exist and the right behaviour is observable.

### The key

The concept doc already decided this: ship with pasted keys, encrypt the
column, never log one. A Superset key is full org access — billing, member
removal, revoking other keys — so the storage rules are not optional.

- AES-256-GCM, key from `SUPERSET_KEY_SECRET` (32 bytes, base64). Railway has no
  KMS; this is the honest version of "encrypt with a KMS key" on that platform,
  and swapping in KMS later changes one module.
- Stored as `iv:authTag:ciphertext`, base64.
- **Never** in a log line, an error message, a tRPC error, or a thrown
  exception. The one place it is decrypted is the Superset client.
- Validated on entry by actually minting a JWT. A key that cannot mint is
  rejected at the screen rather than stored and discovered broken later.

## Onboarding flow

One route, `/onboarding`, with the step resolved **on the server** from what is
missing. Refresh-safe and back-button-safe by construction — there is no
client-held wizard position to desynchronise.

```
no membership          -> workspace      (create team; invitees never see this)
no supersetConnectedAt -> connect        (paste key, validated live)
no projects in org     -> projects       (multi-select; deferrable)
no agentName           -> agent          (name it)
otherwise              -> redirect /{slug}
```

Invitees land on `connect` directly, because accepting an invitation already
gave them a membership.

The project step is the only one that can be skipped, and skipping it is
recorded by simply doing nothing — the absence of project rows is the state.

## API

The first real tRPC procedures; better-auth covers none of this.

| Procedure | |
| --- | --- |
| `superset.connect({ apiKey })` | mints a JWT to validate, stores encrypted, records org id |
| `superset.hosts()` | the caller's machines with live `online` flags |
| `superset.projects({ hostId })` | that host's projects, through the relay |
| `onboarding.selectProjects({ hostId, projectIds })` | writes `projects` rows |
| `onboarding.setAgentName({ name })` | writes `member.agentName` |

All are `protectedProcedure` plus an org check via `resolveOrgAccess`. Every one
decrypts the caller's own key and no one else's.

## Design direction

The screens move toward Linear's density. core's tokens already support it —
`--text-base` is 14px and the gray ramps are tight — so this is layout and
weight, not new tokens:

- Narrower cards (360px, not 384px), less internal padding, more contrast
  between card and ground.
- Headings at `text-base` semibold rather than `text-lg`; supporting copy at
  `text-sm` in `muted-foreground`.
- Primary buttons get real contrast; secondary actions become quiet text
  buttons instead of full-width grey slabs.
- 1px borders at low contrast, `--radius-lg`, and the flat `--shadow-1` rather
  than the heavy popover shadow.
- Light by default; a toggle in the user menu, persisted, `.dark` on `<html>`.

## Testing

Unit, no network:

1. **Key encryption** round-trips, and two encryptions of the same key differ
   (fresh IV each time).
2. **JWT decode** pulls `organizationIds` from a fixture payload, and rejects a
   malformed token rather than returning an empty org list.
3. **Step resolution** returns the right step for each combination of missing
   state, including invitee-skips-workspace.

The network chain is verified by hand against real Superset, since mocking four
of their endpoints would test the mock.

## Out of scope

Channels, messages, threads, agent runs, the offline message queue, `apikey`
and `jwt` better-auth plugins, cloud sandboxes, project de-duplication across
members, and the CLI — deferred to last by explicit decision.

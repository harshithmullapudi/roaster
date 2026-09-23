# Redis, BullMQ, and scheduled tasks

Roster runs all of its background work inside the Next.js process. The
supervisor keeps five `Map`s and a `Set` in module scope
(`supervisor.ts:145-157`), holds one WebSocket per `memberId@hostKey`, and
drives one `setInterval` per live session (`supervisor.ts:687`). A page render
boots it: `apps/web/src/app/[slug]/[channelSlug]/page.tsx:55` calls
`void ensureStarted()`.

That has three consequences. A deploy drops every live watch until the next
`ensureStarted()` re-adopts it. Nothing recurring can be scheduled, because
there is nowhere for a timer to live that outlives a request. And the process
cannot be replicated, because a steer queued in one copy's `pendingSteers` is
invisible to the other.

This design moves background work into a worker process, puts the coordination
it needs in Redis, and adds scheduled tasks — a recurrence rule that posts a
message into a channel, where the channel's own rules decide whether an agent
opens a thread on it.

Object storage is explicitly out of scope. It remains the last thing pinning
the **web** tier to one instance; it does not pin the worker tier.

## Delivery order

1. **Concurrency correctness in Postgres.** The four sites that corrupt data
   under two processes, fixed with conditional updates and real indexes.
   Ships alone, improves the single-process system, and is a prerequisite for
   everything after it.
2. **Redis and the worker process.** `apps/worker`, the connection module, the
   link lease, the command inbox, and the RPC reply channel. At the end of
   this step the web process no longer calls `ensureStarted()`.
3. **Scheduled tasks.** `scheduled_tasks`, `scheduled_task_runs`, the leased
   sweep, and the *Schedules* section in channel settings.

## Background: what is actually coupled

**Ownership belongs to the host link, not the session.** The thing that must
live in exactly one process is the WebSocket opened by `ensureHostLink`
(`supervisor.ts:315`), because `byTerminal` (`supervisor.ts:411`) routes every
`Start`, `Stop`, `Failed` and `PermissionRequest` event through it for *all*
sessions on that machine. So the unit of ownership is the existing `linkKey`,
`${memberId}@${hostKey}` (`supervisor.ts:147`). Sessions inherit their owner
from their link.

**The worker needs no uploads volume.** `attachmentsForMessages`
(`attachments.ts:245`) selects rows and builds relative URLs; it reads no
bytes. `uploadsRoot()` has two call sites (`attachments.ts:103`, `:168`), both
reached only from Next route handlers. The agent fetches attachment bytes over
HTTP from the web server via `roster files download`.

**The web process keeps its own host sockets regardless.**
`apps/web/src/app/api/terminals/stream/route.ts:39` opens a relay WebSocket per
attached terminal viewer, on a different relay path (`/terminal/{id}`) from the
supervisor's (`/events`), sharing none of the `hosts` map. Moving the supervisor
out does not make the web process socket-free. It stays replica-*compatible*,
because those sockets are per-request and a dropped SSE reconnects, but "the
web tier becomes stateless" would be false.

**Three things are already safe** and need no work: `allocateSeq`
(`channels.ts:335`) is a single atomic `UPDATE … SET last_seq = last_seq + 1
RETURNING`, backed by `messages_project_seq_idx`; migrations take
`pg_advisory_lock(4314180723)` (`migrate.ts:136`), so two processes booting
together serialize rather than race; and Centrifugo publishing
(`centrifugo.ts:52`) is a one-shot `fetch` with no client state.

## Step 1: correctness in Postgres

The Redis lease introduced in step 2 is **not** a correctness mechanism. The
`SET NX PX` pattern loses mutual exclusion on failover, and on any pause longer
than the TTL two processes both believe they hold the lease — Redis's own
distributed-locks page says so and prescribes fencing tokens. Compare-and-delete
stops the loser from releasing someone else's lease; it does not stop it doing
the guarded work.

So Postgres is the arbiter and the session state machine is the fencing token.
Each of these is only correct today because one process exists:

| Site | Today | Change |
|---|---|---|
| `finish` (`supervisor.ts:728`) | in-memory `finishing` Set; `patch` at `:784` writes status with no precondition, so a `canceled` can be clobbered by a `completed` | `patchLive`: `UPDATE thread_sessions SET … WHERE id = ? AND status NOT IN (<terminal>) RETURNING`; no rows means someone else finished it. The `finishing` Set **stays**, demoted to a fast path — within one process it still saves a duplicate `captureReply` round-trip to the host — but it is no longer what makes this correct. |
| `persistAgentMessage` (`supervisor.ts:891`) | reads the newest `kind:"agent"` row, compares text, then inserts with no conflict target | give the insert `clientId = agent:<sessionId>:<turnCount>` and `onConflictDoNothing`. No new index — `messages_project_client_id_idx` (`roster.ts:125`) already enforces it, exactly as `postTask` (`task-assignment.ts:107`) relies on it. |
| `completeThread` (`supervisor.ts:1485`) | pre-reads for an existing `✅`, then calls `toggleReaction`, which *deletes* on second call (`reactions.ts:105`) — two racers leave the thread complete with no checkmark | idempotent insert with `onConflictDoNothing` against `reactions_message_member_emoji_idx`; never the toggle |
| `settleDelegationFor` (`delegations.ts:289`) | `UPDATE … SET status` with no status predicate — both racers write the reply into the parent and both steer it | `UPDATE … WHERE id = ? AND status = 'open' RETURNING`; bail when empty |

Two notification paths pass `messageId: null` (`notifications.ts:307`, `:353`),
which falls outside the partial unique index at `roster.ts:529`, so
`notifyThreadFailed` and `notifyDelegationReceived` duplicate under two
processes. Add `notifications.dedupe_key text` with a partial unique index on
`(member_id, dedupe_key) where dedupe_key is not null`, set to
`failed:<sessionId>` and `delegation:<delegationId>` respectively.

`postRequest` (`delegations.ts:218`) inserts with no `clientId`, so a rejected
delegation can leave an orphan "@x asked: …" message. Give it a `clientId`
derived from the delegation.

**A hard ordering constraint, resolved by the seam.** `delegations.ts:188`
awaits `markWaiting` immediately before `startSession`. Enqueued independently,
a fast child could finish and steer the parent before the parent's `waiting`
write lands, leaving it stuck. `markWaiting` (`supervisor.ts:300`) only patches
a row and publishes, so it stays **inline in the web process** and completes
before `startSession` is ever enqueued. The constraint is satisfied by where the
seam falls, not by an ordering rule someone has to remember.

## Step 2: Redis and the worker

### The seam

Sorting the supervisor's exports by what the caller observes — not by whether
they touch a host, which is what makes this subtle:

| Pattern | Operations | Why |
|---|---|---|
| Fire-and-forget enqueue | `startSession`, `steer` | already `void …catch(() => {})` at every call site (`messages.ts:343`, `:445`, `task-assignment.ts:80`, `delegations.ts:190`) |
| Request/response RPC | `cancelThread`, `retryThread`, `reapThread` | the caller blocks on the result: `threads.ts:101` gates a `PRECONDITION_FAILED` on cancel's boolean, `thread-retry.tsx:24` writes retry's response into the react-query cache, and `stopAndReap` (`messages.ts:255`) reaps **before** deleting the thread rows — enqueue that and the rows vanish before the worker reads them, leaking host workspaces permanently |
| Stays inline in web | `completeThread`, `assertReaped`, `createThread`, `markWaiting`, `persistAgentMessage` | Postgres and Centrifugo only |

`retryThread` already shows the right split: `supervisor.ts:1525` patches and
publishes synchronously, and `supervisor.ts:1532` defers only the host
round-trip.

### Redis keys

| Key | Type | Purpose |
|---|---|---|
| `roster:link:owner:{linkKey}` | string, `SET NX PX 30000` | who holds this machine's events socket; renewed every 10s, released by Lua compare-and-delete. Coordination, not correctness. |
| `roster:link:inbox:{linkKey}` | list | durable commands for that machine. Any process `RPUSH`es; the owner drains. |
| `roster:link:door:{linkKey}` | pub/sub | latency doorbell only |
| `roster:reply:{correlationId}` | list | RPC replies; the caller `BLPOP`s with a timeout |
| `roster:steer:{sessionId}` | list | replaces `pendingSteers` (`supervisor.ts:154`); survives a deploy |
| `roster:jwt:invalidate` | pub/sub | cross-process cache clear, see below |

There is deliberately **no** finish lock. Step 1's conditional update is
strictly better.

Redis pub/sub is at-most-once and drops messages to disconnected subscribers,
so **the periodic drain tick is the correctness mechanism and the doorbell is
an optimization**. The owner also drains unconditionally on the subscriber's
`ready` event, so a reconnect costs milliseconds rather than a full tick. A
subscriber connection cannot issue other commands, so it must be its own
ioredis instance.

### The RPC

A caller `RPUSH`es a command carrying a `correlationId` onto the target link's
inbox, publishes the doorbell, and `BLPOP`s `roster:reply:{correlationId}` with
a **15-second** timeout. The owner executes and `RPUSH`es the reply, which
carries a short TTL so an abandoned reply cannot accumulate. The owner drains
its inboxes on every **5-second** tick as well as on the doorbell, so a dropped
pub/sub message costs up to one tick and still lands inside the timeout. On
timeout the tRPC mutation throws a plain "that machine did not answer" error
rather than reporting success —
`assertReaped` (`threads.ts:143`) exists precisely to make an unverified reap
loud, and that property must survive the move.

### Crash recovery

`ensureStarted()` goes away. A repeatable `adopt-orphans` job finds
`starting`/`running` sessions whose link has no live lease and claims them.
Recovery becomes continuous rather than boot-only, and lease expiry is the
crash signal. Nothing in the web process calls into the supervisor.

### Closing the JWT gap

`forgetSupersetCredentials()` (`connection.ts:18`) clears a process-local map,
and its trigger lives in the web process (`superset-connection.ts:21`). With a
worker, a revoked key stays usable there for up to ~50 minutes. Publishing on
`roster:jwt:invalidate` closes it.

### BullMQ

Pin `bullmq@6.3.8`. v6 **removed** the repeatable-job APIs — `repeat` is no
longer a job option, `getRepeatableJobs` and `removeRepeatable` are gone. The
API is:

```ts
queue.upsertJobScheduler(schedulerId, { pattern, tz }, { name, data })
```

Re-upserting the same `schedulerId` atomically replaces the pending occurrence;
`removeJobScheduler(id)` is idempotent.

Used for: the step 3 sweep tick, one-shot host work with backoff
(`startSession`, `reapThread`), and the `adopt-orphans` sweep. Note that no
scheduler is created *per schedule* — step 3 keeps one tick for the whole
system and owns its own occurrence math. **Not** for the poll loop — each
watch's `setInterval` stays on the owning worker. A queue round-trip every
`POLL_INTERVAL_MS` per session buys nothing when lifecycle events are pinned to
the socket anyway.

OSS BullMQ has no job→worker routing and no groups (Pro only), which is why
ownership needs the lease-plus-inbox shape rather than a queue per worker.

Two behaviours the design has to absorb:

- **BullMQ is at-least-once.** A stalled job returns to `wait` and re-runs, and
  a stall does *not* consume a retry attempt. Every processor must be
  idempotent on its own key.
- **Scheduler-produced jobs are exempt from the stall-failure path**
  (`moveStalledJobsToWait-9.lua` skips the failure branch for them), so a
  firing that reliably kills its worker recycles forever. `scheduled_task_runs`
  is what bounds it.

Connection budget, measured: a Worker opens **2** (regular + dedicated
blocking), pub/sub needs its own, and the web-side producer wants a separate
one with `enableOfflineQueue: false` so requests fail fast instead of buffering.

`maxRetriesPerRequest: null` must be set **explicitly**. The docs claim BullMQ
forces it; in 6.3.8 that applies only to the blocking connection, and the
regular connection — which runs `moveToActive`, `extendLock` and the stalled
checks — keeps whatever you passed. ioredis `keyPrefix` throws; use BullMQ's
`prefix`.

Redis must run `maxmemory-policy noeviction` and AOF. Arbitrary eviction breaks
both BullMQ and the inbox lists.

### Packaging

`apps/worker`, run with `tsx`. It cannot be `tsc`: every workspace package is
`noEmit: true` with `moduleResolution: "Bundler"` and extensionless relative
imports, and `@roster/api` is consumed as TypeScript source
(`next.config.ts:9` lists it in `transpilePackages`). The precedent is
`packages/api`'s existing `tsx src/scripts/rerender-agent-messages.ts`.

Five things this needs:

1. A `"./sessions"` subpath in `packages/api`'s `exports`, which today allows
   only `.`, `./client` and `./attachments`. Importing `.` drags in
   `context.ts` → `@roster/auth` → React email `.tsx` templates.
2. A second Docker runner stage. `Dockerfile:87` copies only Next's
   `standalone` bundle — no `@roster/api` source, no `tsx`. Also
   `COPY apps/worker/package.json` in the deps stage, since
   `--frozen-lockfile` compares every workspace member.
3. A second Railway service on the same repo with a start-command override and
   **no** uploads volume. That is also how the worker tier escapes
   `docs/deploying.md:30`.
4. `NEXT_PUBLIC_APP_URL` as a runtime service variable, not only the
   `Dockerfile:47` build ARG. Next inlines it at build time; the worker reads
   it live, and `absoluteAttachmentUrl` (`lib/attachments.ts:29`) silently
   falls back to `localhost:3000` — which would hand agents dead download URLs
   in every retry prompt.
5. Node 22 pinned. The events socket relies on the global `WebSocket`
   honouring an `Authorization` header (`supervisor.ts:340`); on Node 20 that
   is behind a flag and drops headers, while root `engines` says `>=20`.

Migrations stay owned by `apps/web/src/instrumentation.ts`; the worker sets
`ROSTER_SKIP_MIGRATIONS=1` and tolerates restart on a cold deploy, which
Railway's `ON_FAILURE` policy already provides. `docker-entrypoint.sh` ends in
`exec "$@"` and works unchanged.

`REDIS_URL` joins `.env.example` and `turbo.json`'s `globalEnv`, which is also
the moment to add the `SUPERSET_*` and `UPLOADS_DIR` vars already missing
there. Redis joins `docker-compose.dev.yaml` on **6389**, following the
convention that gave Postgres 5442 and Centrifugo 8010.

Graceful shutdown on `SIGTERM` and `SIGINT`: release held leases, then
`worker.close()`. That call has no internal timeout, so bound the drain with
v6's `worker.cancelJob`.

## Step 3: scheduled tasks

> **Revised.** This step was first specced around a cron string driven by
> BullMQ's job scheduler. Both were replaced — see *Why RRule replaced cron*.
> Steps 1 and 2 shipped as written and are unaffected.

A firing creates a task row and posts a message into the channel. It does
**not** start a session itself, which is the second revision: the original
step reused `assignTask` (`task-assignment.ts:12`), and `assignTask` calls
`startSession` unconditionally at `:80`.

That was wrong for a schedule. An ordinary message only wakes an agent when the
channel is watching or an agent is `@`-mentioned (`messages.ts:285`), so
`assignTask`'s unconditional start is a special case that lets a schedule
reach into a channel which has deliberately stopped watching. A firing now
posts through the ordinary path and lets the channel's own rules decide. In a
watching channel the outcome is identical to before; in a quiet one the work
becomes a visible, unclaimed message instead of a surprise session.

### Why RRule replaced cron

Cron cannot say "every other Tuesday", "last Friday of the month", or "the
first Monday after the 15th". Those are ordinary things to want from a
schedule, and the surface here is channel settings — a person choosing when
their agent does something, not an operator editing a crontab. `rrule`'s
`.toText()` reads a stored rule back as "every 2 weeks on Tuesday", which is
what makes a schedule list reviewable at a glance.

BullMQ has no RRule support, so this means owning the occurrence math. That
cost buys back something the cron design was uneasy about: nothing parses
BullMQ's undocumented `repeat:<schedulerId>:<millis>` job-id format any more.
The exact `bullmq@6.3.8` pin keeps its *other* justifications — the v6 API
removals and the `maxRetriesPerRequest` behaviour documented above are still
version-sensitive — but it no longer rests on behaviour observed rather than
promised.

The cost is timezones, and it is real. See *DST* below.

### The tables

```
roster.scheduled_tasks
  id                    uuid pk
  organization_id       uuid not null → organizations (cascade)
  project_id            uuid not null → projects (cascade)
  title                 text not null
  rrule                 text not null        -- FREQ=WEEKLY;INTERVAL=2;BYDAY=TU
  timezone              text not null default 'UTC'
  next_run_at           timestamptz          -- null once the rule is exhausted
  enabled               boolean not null default true
  run_as_member_id      uuid → members (set null)
  created_by_member_id  uuid → members (set null)
  last_run_at           timestamptz
  disabled_reason       text
  created_at, updated_at
  index (enabled, next_run_at)               -- the sweep's only query
  index (project_id)

roster.scheduled_task_runs
  id                 uuid pk
  scheduled_task_id  uuid not null → scheduled_tasks (cascade)
  slot_at            timestamptz not null
  task_id            uuid → tasks (set null)
  outcome            text not null
  detail             text
  created_at         timestamptz
  unique (scheduled_task_id, slot_at)
  index (scheduled_task_id, created_at desc)
```

`project_id` stays `not null`: a schedule whose whole job is to post in a
channel has no meaning in the backlog.

**`next_run_at` is now stored, reversing the original decision.** That decision
— "BullMQ owns that truth, storing it would be a second source of truth to
drift" — was right while BullMQ held the schedule. Once we own the occurrence
math there is no other copy to drift from, and it is what makes the sweep an
indexed lookup rather than a full scan that deserializes every rule each
minute.

`outcome` is one of `fired`, `skipped_late`, `skipped_no_access`, `failed`. The
unique index on `(scheduled_task_id, slot_at)` is still what makes at-least-once
redelivery harmless, and still the "did this slot run?" ledger Redis does not
keep.

### The sweep

One BullMQ job scheduler for the whole system — `every: 60_000` — not one per
schedule. `every` is documented API, unlike the job-id format the previous
design read.

The sweep worker is started and stopped with the supervisor lease the worker
process already holds, so exactly one worker runs it without a second lease of
its own. For each row where `enabled AND next_run_at <= now()`:

1. Insert the `scheduled_task_runs` row for `slot_at = next_run_at` with
   `onConflictDoNothing`. **No rows back means another sweep already took this
   slot — stop.** This is the idempotency boundary; everything after it is
   allowed to be at-least-once.
2. Fire, unless the slot is stale (below).
3. Recompute `next_run_at` from the rule and write it with `last_run_at`.

Step 3 must run even when step 2 skips, or a stale schedule never advances.

### Late firings

`slot_at` is simply the `next_run_at` that was stored, so the original design's
reverse-engineering of a BullMQ job id disappears. The rule is unchanged: a slot
fired more than **15 minutes** past its time records `skipped_late` and posts
nothing. A 3am cleanup should not wake an agent at 11am on Monday, and the runs
table keeps the honest record.

Unlike the BullMQ scheduler — which held one delayed job and silently dropped
every intermediate slot — the sweep can see that several slots elapsed. It still
fires at most one: catching up on eight missed 3am cleanups at once is worse
than skipping seven. The skipped ones are recorded.

### What a firing does

Post via `sendMessage` (`messages.ts`) with `clientId = task:<taskId>`.
`postTask` survives as a thin wrapper over it rather than the direct insert it
was, so the web assign path and a firing take the same route. `sendMessage`
already returns an existing message for a `clientId` it has seen, and carries
`onConflictDoNothing` on `(projectId, clientId)` besides, so a redelivered
firing is harmless at the message layer too.

The firing runs as `run_as_member_id`, so `requireOrgProject`'s real access
checks apply and a schedule cannot become a way to post into a channel its owner
cannot reach.

**Thread linking moves.** The sweep cannot link `tasks.thread_id` after posting:
`driveSession` is fire-and-forget (`messages.ts:345`) and returns no thread, and
in a non-watching channel there is no thread to link at all. Instead
`driveSession` links it — it already builds the thread with
`rootMessageId: message.id`, so when that root message carries a `task:<uuid>`
client id it calls `linkTaskThread`. One place owns the linking, the web assign
path and a firing behave identically, and the unclaimed case resolves itself:
no thread, `thread_id` stays null, and the task reads as filed-but-unstarted.

**A firing never joins an open thread.** `sendMessage` folds a message into a
thread opened in the last 10 seconds by the same author (`JOIN_WINDOW_MS`,
`messages.ts:295`). Two schedules landing on the same minute as the same
`run_as` member would then link two tasks to one thread and violate
`tasks_thread_idx`. The firing path opts out of joining explicitly, which also
preserves the rule below.

### When a schedule's identity breaks

Three failures — the member was removed, the member lost access
(`requireOrgProject` returns null), or `run_as_member_id` is null — all resolve
the same way: record `skipped_no_access`, set `enabled = false` and
`disabled_reason`, and **post a plain message in the channel saying so**. That
needs no new `NOTIFICATION_TYPES` entry, it is visible to everyone who cares,
and it matches how the rest of Roster surfaces state. A dead schedule is loud.

A deleted channel cascades the schedule away.

### Overlap

Each firing opens a new thread, even if the previous one is still running. No
suppression: silently skipping work is worse than two threads. `skip_if_running`
is a one-column follow-up if it turns out to be annoying.

### DST

`rrule` computes in UTC. "Every weekday at 9am in Asia/Kolkata" therefore has to
be generated against local wall-clock time and mapped back, which needs a date
library beside it. Get this wrong and a schedule drifts by an hour twice a year,
silently, in exactly the half of the year nobody is looking.

Kolkata has no DST, so the first users will not surface this. That is precisely
why it is written down: the bug ships green and appears in October. Occurrence
math across a spring-forward and a fall-back boundary is the one part of this
step that must have tests before it has users.

### Surfaces

**The new-task dialog** gains a schedule control beside status and channel —
Now / Once at… / Repeating…. **Now** is today's behaviour untouched. **Once
at…** is a rule with `COUNT=1`, so one-shots and recurrences share one code
path instead of growing a second. **Repeating…** opens the rule picker and
displays it back through `.toText()`.

Channel becomes **required in this dialog** — the picker loses `clearable` and
the "Waits in the backlog" hint. The consequence, stated plainly because it is
asymmetric: a person can no longer file to the backlog; only an agent can. That
is deliberate. Someone filing a task from the UI knows where the work belongs,
while an agent calling `roster tasks create` frequently does not, which is the
reason the backlog exists. The backlog stays fully visible in the task list.

**`roster tasks create` is unchanged**, and `--channel-id` stays optional.
Agents creating their own *recurring* jobs remains out of scope — a different
question that deserves its own thought.

**Channel settings** gets a *Schedules* section — list, create, edit, toggle,
delete — with next run read straight off `next_run_at` and the last few
`scheduled_task_runs` inline, so a `skipped_late` is visible rather than
mysterious. An invalid rule is rejected at the tRPC boundary by parsing it,
never by regex.

**Attribution.** Tasks already carry `createdBy` through to an avatar on the
row. Schedules show the same, plus *who it runs as* — `run_as_member_id` is
whose access every firing borrows, so it belongs on screen next to the rule.

## Structure

| File | What changes |
|---|---|
| `packages/api/src/lib/redis.ts` | new — connection factory, the three connection profiles, lease acquire/renew/release Lua |
| `packages/api/src/services/queues.ts` | new — queue definitions, `upsertJobScheduler` wrappers |
| `packages/api/src/services/sessions/links.ts` | new — lease, inbox drain, doorbell, RPC |
| `packages/api/src/services/sessions/supervisor.ts` | `finishing` and `pendingSteers` removed, conditional `finish`, commands arrive via the inbox |
| `packages/api/src/services/scheduled-tasks.ts` | new — CRUD, the leased sweep, and the firing function |
| `packages/api/src/lib/recurrence.ts` | new — rule parsing, `.toText()`, and next-occurrence in a timezone. The only place `rrule` is imported |
| `packages/api/src/routers/scheduled-tasks.ts` | new |
| `packages/api/src/services/messages.ts` | firing path opts out of `joinableThread`; `driveSession` links a `task:<uuid>` root message to its task |
| `packages/api/src/services/task-assignment.ts` | `startSession` no longer forced; `postTask` becomes a wrapper over `sendMessage`; `setTaskProject` records the channel so a quiet channel still assigns |
| `packages/api/src/services/schedule-queue.ts` | new — the one `every: 60_000` scheduler and its queue |
| `packages/api/src/services/schedules.ts` | new — the `@roster/api/schedules` entry the worker imports |
| `apps/worker/src/schedule-worker.ts` | new — runs the sweep, started and stopped with the supervisor lease |
| `apps/web/src/components/tasks/schedule-picker.tsx` | new — Now / Once at / Repeating, and the rule it builds |
| `apps/web/src/components/channels/channel-schedules.tsx` | new — the Schedules section |
| `packages/api/src/services/delegations.ts` | conditional settle, `clientId` on `postRequest` |
| `packages/api/src/services/notifications.ts` | dedupe keys for the two `messageId: null` paths |
| `packages/db/src/schema/roster.ts` | `scheduled_tasks` and `scheduled_task_runs`; `notifications.dedupe_key` plus its partial unique index for step 1 |
| `apps/worker/` | new — entry, BullMQ workers, shutdown |
| `apps/web/src/app/[slug]/[channelSlug]/page.tsx` | `ensureStarted()` removed |
| `apps/web/src/components/channels/channel-settings.tsx` | Schedules section |
| `apps/web/src/components/tasks/new-task-dialog.tsx` | schedule control; channel picker loses `clearable` |
| `docker-compose.dev.yaml`, `Dockerfile`, `.env.example`, `turbo.json`, `docs/deploying.md` | Redis, worker stage, env |

`supervisor.ts` is 1622 lines before this change. The lease, inbox and RPC go in
`links.ts` rather than growing it further.

## Testing

### Unit

Rule validation and next-occurrence computation, **including a spring-forward
and a fall-back boundary in a DST zone** — the one part of step 3 that must have
tests before it has users. An exhausted `COUNT`/`UNTIL` rule yields a null
`next_run_at` rather than looping. Grace-window arithmetic, including a firing
exactly on the boundary. Lease Lua release: the holder releases, a non-holder
does not.

### Database

A firing in a **watching** channel produces exactly one task, one message, one
thread. The same firing in a **quiet** channel produces one task and one message
and **no thread** — the assertion that the channel's rules, not the schedule,
decide whether an agent runs. A **second firing of the same slot produces
nothing** — the real assertion for at-least-once delivery. Two schedules firing
into one channel within the join window produce two threads, not one violated
`tasks_thread_idx`. `skipped_no_access` when the run-as member lost the channel,
with the schedule disabled and the notice posted. Conditional `finish` rejects a second
terminal transition. `completeThread` twice leaves the ✅ present — this one
fails today. `settleDelegationFor` twice writes one reply and steers once.

### Redis

Against a real Redis, not a mock. Two workers cannot both hold one link's
lease. An expired lease is adopted by the sweep. A command `RPUSH`ed while no
owner exists is executed when one appears. A dropped pub/sub message still gets
drained by the tick. RPC timeout surfaces as an error, never as success.

### End to end

Schedule due → message in channel → thread opens → session starts. Worker
killed mid-session → another worker adopts it and the thread does not stall.

## Risks

**The lease's failure window is real and accepted.** On Redis failover, or a
pause past the 30s TTL, two workers can briefly both believe they own a link.
The consequence is bounded to duplicate polling and a duplicate socket, because
step 1 makes every state transition conditional. This is only true if step 1
ships first; skipping it converts the same window into duplicate agent
messages, double steers, and a missing ✅.

**DST is the sharp edge of choosing RRule.** Owning the occurrence math means
owning timezone correctness, and a rule that drifts an hour at a DST boundary
fails silently, in one direction, six months after it ships green. No current
user is in a DST zone, which removes the pressure to get it right and is exactly
why it is called out as a risk rather than left to implementation.

**A minute tick is a standing cost.** The sweep runs every 60 seconds forever,
whether or not any schedule exists. It is one indexed query against
`(enabled, next_run_at)` and should stay negligible, but it is a floor that the
per-schedule BullMQ design did not have — and if it ever stops being negligible,
the query, not the interval, is what to look at first.

**A second service is a real operational step.** Web and worker must share
`SUPERSET_KEY_SECRET` byte-for-byte, and a worker running without
`CENTRIFUGO_*` silently degrades to no realtime (`centrifugo.ts:58` returns
`false` and logs nothing).

**Replicas still are not reachable for the web tier.** Object storage is out of
scope, so `docs/deploying.md:30` stays true of web. This design makes the
worker tier replicable and removes the supervisor from the request path; it does
not finish the replica story.

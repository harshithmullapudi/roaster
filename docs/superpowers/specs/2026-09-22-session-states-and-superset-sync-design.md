# Session states and Superset sync

Three reported problems share one cause: Roster treats "the agent stopped
talking" as "the session is over."

1. A thread cannot distinguish an agent that is working from one that is
   waiting on a person from one that has simply stopped.
2. Taking a session over in Superset and continuing there leaves no trace in
   the thread.
3. A subagent run shows as an unexplained quiet spell.

This design fixes (1) and (2). (3) is deferred — see "Deferred: subagents".

## Delivery order

1. **The state model** — `needs_input` and `idle`, the dots, the question
   card, the notification. Self-contained: on `Stop` the session parks at
   `idle` and the watch stops as it does today, and a thread reply revives it
   through the existing `resume()`.
2. **The watcher and the sync** — the watch survives into `idle`, and
   Superset-side turns come back as messages.
3. **Clickable answers** — `roster ask-human`, mirroring `roster ask`, so an
   option clicked in the thread resumes the agent with that exact answer.
   Driving Claude Code's TUI with positional keystrokes was considered and
   rejected: a mis-parse would silently send the wrong answer.

## Background

`thread_sessions.status` is `starting | running | waiting | completed |
failed | canceled`. `waiting` already means *parked on a delegate*
(`roster ask`), not *waiting on a human*.

When the agent's binding goes idle, `pollOnce` calls
`finish(status: "completed")`, which calls `stopWatch` and tears down the
poll timer and the host events socket (`supervisor.ts:493`, `595`). The
worktree survives — `reapThread` only runs when the thread is deleted or
marked complete. So after every turn there is a live worktree that nothing
is watching. That is the whole of problem (2).

The supervisor already receives a `PermissionRequest` lifecycle event from
Superset and discards it (`supervisor.ts:388`). That is the missing signal
for problem (1).

Two facts make this cheaper than expected:

- `status` is `text("status")` with no enum and no check constraint
  (`packages/db/src/schema/roster.ts:271`). New statuses need no migration.
- `messages_project_client_id_idx` is a unique index on
  `(project_id, client_id)`. Sync idempotency is enforced by the database.

## The state model

| status | dot | meaning |
|---|---|---|
| `starting` | grey | worktree being made, agent launching |
| `running` | blue | agent working |
| `needs_input` | amber | `PermissionRequest` arrived, no `Stop` yet — **new** |
| `idle` | grey | `Stop` settled, worktree alive, still watched — **new** |
| `waiting` | violet | parked on a delegate — unchanged meaning |
| `completed` | ✓ | human ticked the thread, or worktree reaped |
| `failed` | red | |
| `canceled` | grey | |

Transitions:

```
Start             → running        (also promotes needs_input/idle → running)
PermissionRequest → needs_input
Stop | Detached   → idle           role = main
Stop | Detached   → completed      role = delegate
reply while idle  → running        via existing resume()
thread completed  → completed
worktree reaped   → completed
```

### Delegates still complete

`finish(completed)` is what triggers `settleIfDelegated`, which hands a
delegate's answer back to the parent thread (`supervisor.ts:729`). If
delegates went idle, parent threads would hang forever and worktrees would
leak. A delegate exists to answer one question and end.

So the idle transition is scoped to `role === "main"`. This rule is the most
likely thing for a later edit to break, so it is pinned by a table-driven
test rather than left as a conditional in a long function.

### Naming

`isParked()` currently means "waiting on a delegate". With `idle` and
`needs_input` arriving, that name becomes actively misleading. Rename to
`isDelegating()`. Add `isIdle()`. `isTerminal()` is unchanged — `idle` is
not terminal.

### Surfaces

- `LIVE_THREAD_STATUSES` (`queries.ts:402`) gains `needs_input` but **not**
  `idle`. Including `idle` would make every thread ever run appear live in
  the sidebar forever.
- `LEAD_ORDER` (`queries.ts:198`) orders `needs_input` directly after
  `running` — a thread wanting a person outranks one merely working.
- `NOTIFICATION_TYPES` gains `agent_needs_input`.
- `THREAD_STATUSES` and the web `TONE` map both gain the two new entries.

## The watcher

The watch survives into `idle`, tiered so the cost is bounded:

| state | poll interval |
|---|---|
| `running`, `needs_input` | 2s (today's `POLL_INTERVAL_MS`) |
| `idle` | 20s |
| idle > 6h, worktree reaped, or thread completed | watch released |

A released watch is re-armed on demand when someone opens the thread.

The slow poll is a backstop, not the mechanism. The host events websocket
stays connected for as long as the watch lives, so a `Start` event — which
is what typing a prompt in Superset produces — promotes the watch back to
2s within one round trip.

## The sync

`thread_sessions.transcript_offset` already exists and is effectively
unused: it is written as `text.length` alongside progress and never read.
It becomes the high-water mark of transcript consumed into messages.

```
poll → readTranscript()
     → source === "harness" → parse turns past transcript_offset
                            → post each as a real message, source = "superset"
     → otherwise            → one digest message per idle transition,
                              text = transcriptTail(), rendered collapsed
```

### Why real messages, and why the digest fallback

Real messages are searchable, replyable, reactable, and drive unread state
and notifications. A collapsed blob is none of those things, permanently.
The decision is also asymmetric: collapsing runs of Superset messages later
is a UI change on top of real messages, whereas promoting a collapsed blob
into real messages later is a backfill migration. Inline is the reversible
choice.

The fallback exists because fidelity, not preference, decides what the data
can support. `readTranscript` reports `source: harness | stream | screen`
(`packages/superset/src/agents.ts:220`). Only `harness` gives clean
`User:` / `Assistant:` turn boundaries. A `screen` source is a scraped
terminal — ANSI, half-drawn spinners, box chrome — and posting that as
first-class messages is worse than hiding it behind a disclosure.

### Three things that must be right

**Idempotency.** Each synced turn gets `clientId = sync:<sessionId>:<turnIndex>`.
The existing unique index on `(project_id, client_id)` makes a re-read that
overlaps the offset a no-op at the database level.

**Partial trailing turns.** A transcript read mid-reply ends with an
incomplete `Assistant:` turn. The parser must withhold the final turn unless
a subsequent turn marker or an idle transition proves it complete. Posting
half a reply is the most visible possible failure.

**Echo suppression.** A prompt Roster sent via `sendToAgent` reappears in the
transcript as a `User:` turn. Roster keeps a small per-session ring of
recently-sent prompt hashes; a matching `User:` turn advances the offset
without posting. The window is bounded in time so that a human legitimately
retyping the same text later is not silently swallowed.

### Attribution

We cannot know which human typed in Superset. The best available signal is
the session's `run_as_member_id` — the member whose credentials the session
runs under. Superset-origin messages are posted as that member and badged
`via Superset`.

This needs one migration: `messages.source text null`. `null` means the
message originated in Roster; `"superset"` means it was synced.

## The input-needed card

When status is `needs_input`, the card that already renders progress
(`thread-panel.tsx:133`) shows the agent's question instead.

Question text, in order of preference:

1. `preview` on the `PermissionRequest` event. `notify.sh:217` populates it
   from `message` / `last_assistant_message`. Better text, but it depends on
   the relay forwarding the field, which is unverified.
2. `agentReply(transcript)` read when the event arrives. For a question, the
   agent's last assistant turn is the question. No unknowns.

Use 1 when present, else 2, so the card is never blocked on a Superset
change.

```
┌─────────────────────────────────────────────┐
│ ● needs input · 4m                          │  amber dot,
│                                             │  amber left border
│ @roster-atom-whip is asking                 │
│                                             │
│ Which auth method should the CLI use for    │
│ the relay handshake — device code or PAT?   │
│                                             │
│ ╭─────────────────────────────────────────╮ │
│ │ Reply to answer…                        │ │  focuses the composer
│ ╰─────────────────────────────────────────╯ │
└─────────────────────────────────────────────┘
```

Answering needs no new plumbing: a thread reply routes through `steer()` →
`sendToAgent`, and adding `idle` and `needs_input` to the resume path lands
it in the waiting agent.

The `agent_needs_input` notification carries the question as its preview, so
the inbox shows the question rather than "agent is waiting".

**Out of scope: Approve/Deny buttons.** Those require injecting keystrokes
into a TUI to drive Claude Code's permission chooser — harness-specific and
broken by any re-render of that widget. Text answers cover questions;
permission prompts are approved in Superset as today.

## Deferred: subagents

Superset's hook script routes subagent events away from terminal-level agent
status by design (`~/.superset/hooks/notify.sh:44-49`):

> Subagent activity must not drive terminal-level agent status,
> notifications, or the session id binding — only the main loop counts. It is
> forwarded separately so the host can keep a per-terminal roster of live
> subagents.

They are dispatched to `notifications.hook` with a separate
`subagent: {id, type, sessionId, transcriptPath, agentTranscriptPath}`
payload, not to the `agent:lifecycle` stream Roster subscribes to. Nothing in
the installed Superset app consumes `agentTranscriptPath`, so the host
appears to drop them, and nothing rebroadcasts to the relay.

This is a display gap, not a correctness bug: a subagent run never emits a
terminal-level `Stop`, so Roster does not falsely end the session. During a
subagent run the thread shows `running`, which is correct but coarse.

Unblocking it requires Superset forwarding subagent events to the relay
stream. Filed as a task; no Roster-side work until then. The transcript
heuristic alternative — pattern-matching Claude's rendered Task block — was
considered and rejected as too brittle to maintain.

## Structure

Tricky logic moves into pure modules so it is testable without a host:

- `packages/api/src/utils/session-state.ts` — `nextStatus({current, role, event})`
- `packages/api/src/utils/transcript-turns.ts` — transcript + offset → turns
- `packages/api/src/utils/echo-window.ts` — recently-sent prompt suppression
- `packages/api/src/utils/poll-tier.ts` — interval and release policy

`supervisor.ts` is already 1528 lines. These extractions take logic out of
it rather than adding to it, which is the right direction for a file that
size.

## Testing

### Unit

- `session-state` — table-driven over every (status × event × role). Pins the
  delegate-completes / main-idles rule.
- `transcript-turns` — clean transcript; **partial trailing turn**; no role
  markers (digest path); ANSI screen scrape.
- `echo-window` — a Roster-sent prompt is consumed silently; the same text
  typed by a human ten minutes later is not suppressed.
- `poll-tier` — interval per status; release on 6h idle, reap, completion.
- `notification-type` — extended for `agent_needs_input`.

### Database

- main session on `Stop` → `idle`, worktree intact, watch retained;
  delegate on `Stop` → `completed` and `settleIfDelegated` fires.
- two polls over an overlapping transcript produce exactly N messages.

### Web

- `thread-rows` — labels and liveness for `idle` and `needs_input`; `idle`
  must not count as live.
- a test asserting `TONE` covers every entry in `THREAD_STATUSES`, so adding
  a status without a colour fails CI rather than rendering a silent grey dot.

### End to end

Needs a live host, so it is a scripted manual pass:

```
1. ask the agent something         → ● running (blue)
2. agent hits a permission prompt  → ● needs input (amber) + notification,
                                      question rendered in the card
3. approve it in Superset          → ● running
4. agent finishes                  → ● idle (grey), not "Completed"
5. type a follow-up in Superset    → ≤20s: prompt and reply appear in the
                                      thread, badged "via Superset"
6. reply in the thread instead     → ● running, same worktree
7. tick the thread complete        → ✓ completed, watch released, reaped
```

Steps 4→5 are the reported sync failure. Step 2 is the new amber state.

## Risks

**Threads stop auto-closing.** Today a thread ends itself. After this, it
rests at `idle` until a person ticks it complete — there is no age-out, by
design, because an age-out would resurrect exactly the "Roster decided it was
over" behaviour this removes. Worktrees therefore live longer. The 6h watch release bounds the watching cost but not
the disk cost; if worktree accumulation becomes a problem, an idle-age reap
is the follow-up, and it is independent of this work.

**Sync noise.** If a takeover runs long, the thread gains a message per turn.
Message grouping absorbs some of this. If it proves too noisy, collapsing
runs of Superset-origin messages is a UI change on top of real messages —
deliberately kept reversible.

**Unverified relay fields.** Both `preview` on `PermissionRequest` and
subagent forwarding depend on what the relay actually sends. Each has a
fallback that needs no Superset change, so neither blocks delivery.

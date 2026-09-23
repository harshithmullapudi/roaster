# Postgres Concurrency Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every write in the session supervisor safe to run from two processes at once, so a Redis lease can be an optimization rather than the thing correctness depends on.

**Architecture:** Replace four in-memory or read-then-write guards with database-enforced ones: a conditional `UPDATE … WHERE <expected state> RETURNING` where a state transition must not be clobbered, and `onConflictDoNothing` against a real unique index where an insert must not duplicate. No Redis, no new process, no new dependency — this step ships alone and improves the single-process system.

**Tech Stack:** TypeScript, Drizzle ORM, Postgres 16, vitest. Existing packages only.

**Spec:** `docs/superpowers/specs/2026-09-23-redis-bullmq-and-scheduled-tasks-design.md` (step 1 of three)

## Global Constraints

- **No code comments.** Write code that reads on its own; reasoning goes in the commit message, not the source.
- **Tests live beside their source.** `foo.test.ts` for pure units, `foo.db.test.ts` for anything touching Postgres.
- Every database test is wrapped in `describe.skipIf(!hasDatabase)` with `const hasDatabase = Boolean(process.env.DATABASE_URL)`.
- Database tests need `pnpm dev:db` running and `DATABASE_URL` set. Run them with `pnpm --filter @roster/api test <name>`.
- Schema changes go in `packages/db/src/schema/roster.ts` and get a migration via `pnpm db:generate`. Never hand-edit generated SQL.
- `drizzle.config.ts` already carries `schemaFilter: ["public", "auth"]`; do not change it.
- Keep `packages/api`'s `exports` map untouched. The `./sessions` subpath belongs to step 2.
- Every task in this plan is behaviour-preserving on the happy path. If an existing test changes its expected output, stop — that is a signal the change went further than intended.

## Review Focus

Five conditions the spec implies but that no happy path exercises. Each has its test assigned to the task that owns the code.

1. **An explicit cancel must still end a session parked on a delegate.** `finishOnce` returns early for parked sessions on a lifecycle `Stop`, but `waiting` is not terminal, so `cancelThread` must keep working on it. A conditional update whose predicate was drawn too tightly would silently start refusing those. Test in Task 3.
2. **The same session legitimately saying identical text twice is now suppressed.** Scoping the dedupe key to `(sessionId, hash(text))` is wider than today's "same as the immediately previous agent message". Accepted trade — a dropped duplicate, not a lost distinct message — but it must be pinned so nobody finds it as a bug. Test in Task 4.
3. **`completeThread` on a thread whose root message is gone.** The reaction insert carries a foreign key to `messages`; completing a thread as its messages are deleted must not throw. Test in Task 5.
4. **Two different sessions notifying the same member must not collide.** A dedupe key of just `failed` per member would swallow the second session's notification entirely. Test in Task 8.
5. **A settle racing a cancel of the child thread.** The delegation is `open` but the child is already terminal; the settle must still close it exactly once, or the parent waits forever. Test in Task 6.

---

### Task 1: A shared fixture for database tests

Four existing `.db.test.ts` files each rebuild the same org/user/member/project by hand. This step's five new tests would make nine. Extract it once, first, so every later task is a one-line fixture call and the tests stay readable.

Do **not** rewrite the four existing tests to use it. They pass; leave them alone.

**Files:**
- Create: `packages/api/src/test/fixtures.ts`
- Test: `packages/api/src/test/fixtures.db.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export interface Fixture {
  orgId: string;
  userId: string;
  memberId: string;
  projectId: string;
  channel(slug: string): Promise<string>;
  thread(args?: { status?: string; text?: string }): Promise<{
    threadId: string;
    sessionId: string;
    rootMessageId: string;
    projectId: string;
  }>;
  cleanup(): Promise<void>;
}

export function hasDatabase(): boolean;
export async function makeFixture(name: string): Promise<Fixture>;
```

`channel(slug)` creates an additional project in the same org and returns its id. `thread()` creates a root message, a thread on it, and a `main` session with the Superset columns populated, defaulting to `status: "running"`.

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/test/fixtures.db.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { hasDatabase, makeFixture } from "./fixtures";

describe.skipIf(!hasDatabase())("the database fixture", () => {
  it("builds a channel with a thread and cleans itself up", async () => {
    const fixture = await makeFixture("fixture-self");
    const first = await fixture.thread();
    const second = await fixture.thread({ status: "waiting" });

    expect(first.threadId).not.toBe(second.threadId);
    expect(first.projectId).toBe(fixture.projectId);

    const { db, threadSessions } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select({ status: threadSessions.status })
      .from(threadSessions)
      .where(eq(threadSessions.id, second.sessionId));
    expect(row?.status).toBe("waiting");

    const other = await fixture.channel("second");
    expect(other).not.toBe(fixture.projectId);

    await fixture.cleanup();

    const { organizations } = await import("@roster/db");
    const left = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, fixture.orgId));
    expect(left).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @roster/api test fixtures`
Expected: FAIL — `./fixtures` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/api/src/test/fixtures.ts`:

```ts
import { randomUUID } from "node:crypto";

import {
  db,
  members,
  messages,
  organizations,
  projects,
  threads,
  threadSessions,
  users,
} from "@roster/db";
import { eq } from "drizzle-orm";

export interface Fixture {
  orgId: string;
  userId: string;
  memberId: string;
  projectId: string;
  channel(slug: string): Promise<string>;
  thread(args?: { status?: string; text?: string }): Promise<{
    threadId: string;
    sessionId: string;
    rootMessageId: string;
    projectId: string;
  }>;
  cleanup(): Promise<void>;
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function makeFixture(name: string): Promise<Fixture> {
  const orgId = randomUUID();
  const userId = randomUUID();
  const memberId = randomUUID();
  const projectId = randomUUID();

  await db.insert(users).values({
    id: userId,
    name,
    email: `${userId}@example.test`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(organizations).values({
    id: orgId,
    name,
    slug: `${name}-${orgId.slice(0, 8)}`,
    createdAt: new Date(),
  });
  await db.insert(members).values({
    id: memberId,
    organizationId: orgId,
    userId,
    role: "owner",
    createdAt: new Date(),
  });

  async function addProject(id: string, slug: string): Promise<string> {
    await db.insert(projects).values({
      id,
      organizationId: orgId,
      supersetProjectId: "superset-project",
      supersetHostId: "host-1",
      supersetOrgId: orgId,
      name: slug,
      slug,
      addedByMemberId: memberId,
    });
    return id;
  }

  await addProject(projectId, name);

  let seq = 0;

  return {
    orgId,
    userId,
    memberId,
    projectId,

    channel: (slug) => addProject(randomUUID(), slug),

    async thread(args = {}) {
      seq += 1;
      const [root] = await db
        .insert(messages)
        .values({
          organizationId: orgId,
          projectId,
          seq,
          authorMemberId: memberId,
          kind: "user",
          body: { type: "doc", content: [] },
          text: args.text ?? "go",
        })
        .returning({ id: messages.id });

      const [thread] = await db
        .insert(threads)
        .values({ organizationId: orgId, projectId, rootMessageId: root!.id })
        .returning({ id: threads.id });

      const [session] = await db
        .insert(threadSessions)
        .values({
          threadId: thread!.id,
          projectId,
          role: "main",
          runAsMemberId: memberId,
          status: args.status ?? "running",
          supersetWorkspaceId: "workspace-1",
          supersetTerminalId: `terminal-${thread!.id}`,
          supersetHostKey: "host-1",
        })
        .returning({ id: threadSessions.id });

      return {
        threadId: thread!.id,
        sessionId: session!.id,
        rootMessageId: root!.id,
        projectId,
      };
    },

    async cleanup() {
      await db.delete(threads).where(eq(threads.organizationId, orgId));
      await db.delete(messages).where(eq(messages.organizationId, orgId));
      await db.delete(projects).where(eq(projects.organizationId, orgId));
      await db.delete(members).where(eq(members.organizationId, orgId));
      await db.delete(organizations).where(eq(organizations.id, orgId));
      await db.delete(users).where(eq(users.id, userId));
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @roster/api test fixtures`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/test/fixtures.ts packages/api/src/test/fixtures.db.test.ts
git commit -m "test: one fixture for database tests to build an org on

Four suites each rebuilt the same org, member, project, thread and
session by hand, and this branch adds five more. One builder keeps the
concurrency tests about concurrency instead of about setup."
```

---

### Task 2: A host-free test harness for the supervisor

Every test after this one calls into `supervisor.ts`, which reaches a Superset host. The mocks are identical in all of them, so define them once as a module the tests import for their side effect.

**Files:**
- Create: `packages/api/src/test/mock-superset.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a module whose import registers `vi.mock` for `@roster/superset` and `../services/sessions/connection`. Tests import it first, before any `await import` of application code.

- [ ] **Step 1: Write the implementation**

There is no test for a mock module; its correctness is proven by the tasks that use it. Create `packages/api/src/test/mock-superset.ts`:

```ts
import { vi } from "vitest";

vi.mock("@roster/superset", () => ({
  createWorkspace: vi.fn(async () => ({ id: "workspace-1" })),
  runAgent: vi.fn(async () => ({ sessionId: "terminal-1" })),
  sendToAgent: vi.fn(async () => undefined),
  interruptAgent: vi.fn(async () => undefined),
  deleteWorkspace: vi.fn(async () => undefined),
  clearWorkspaceStatuses: vi.fn(async () => undefined),
  listAgentBindings: vi.fn(async () => []),
  readTranscript: vi.fn(async () => ({ chunks: [], nextOffset: 0 })),
  bindingIsIdle: vi.fn(() => true),
  isAgentLifecycle: vi.fn(() => false),
  eventsUrl: vi.fn(() => "http://localhost/events"),
  mintJwt: vi.fn(async () => ({ jwt: "jwt" })),
  decodeJwtClaims: vi.fn(() => ({})),
}));

vi.mock("../services/sessions/connection", () => ({
  hostConnection: vi.fn(async () => ({
    jwt: "jwt",
    hostKey: "host-1",
    memberId: "member-1",
    project: { supersetProjectId: "superset-project" },
  })),
  jwtForMember: vi.fn(async () => ({ jwt: "jwt" })),
  forgetSupersetCredentials: vi.fn(() => undefined),
  NO_MEMBER: "no member",
}));
```

Before writing this, open `packages/api/src/services/sessions/connection.ts` and confirm the exact set of exports. A `vi.mock` factory that omits one export makes any importer throw at module load, and the error names the missing binding rather than the cause.

- [ ] **Step 2: Verify it loads**

Run: `pnpm --filter @roster/api typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/test/mock-superset.ts
git commit -m "test: one place that stubs the Superset host

Three suites in this branch drive the supervisor, which would otherwise
open a relay socket. The stubs were going to be copied into each."
```

---

### Task 3: A conditional session patch, and finishing exactly once

`patch` (`supervisor.ts:229`) writes unconditionally, and `finishOnce` (`supervisor.ts:747`) guards double-finish with the in-memory `finishing` Set (`supervisor.ts:153`). Keep the Set — within one process it usefully avoids a duplicate transcript read — but make the write itself conditional, so the database and not the Set decides who won.

**Files:**
- Modify: `packages/api/src/services/sessions/supervisor.ts:229-240` (add `patchLive`), `:784` (use it)
- Test: `packages/api/src/services/sessions/finish-once.db.test.ts`

**Interfaces:**
- Consumes: `makeFixture`, `hasDatabase` from Task 1; `mock-superset` from Task 2.
- Produces: `patchLive(sessionId: string, values: Partial<SelectThreadSession>): Promise<SessionView | null>` — the updated session, or `null` when the row was already terminal or absent. Task 5 does not need it; step 2 of the spec does.

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/services/sessions/finish-once.db.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import "../../test/mock-superset";
import { hasDatabase, makeFixture } from "../../test/fixtures";

describe.skipIf(!hasDatabase())("finishing a session", () => {
  it("refuses to patch a session that already ended", async () => {
    const fixture = await makeFixture("patch-live");
    const { sessionId } = await fixture.thread();
    const { patchLive } = await import("./supervisor");

    expect((await patchLive(sessionId, { status: "completed" }))?.status).toBe("completed");
    expect(await patchLive(sessionId, { status: "failed" })).toBeNull();

    const { db, threadSessions } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select({ status: threadSessions.status })
      .from(threadSessions)
      .where(eq(threadSessions.id, sessionId));
    expect(row?.status).toBe("completed");

    await fixture.cleanup();
  });

  it("keeps the first terminal status when two cancels race", async () => {
    const fixture = await makeFixture("cancel-race");
    const { threadId, sessionId } = await fixture.thread();
    const { cancelThread } = await import("./supervisor");

    await Promise.all([cancelThread({ threadId }), cancelThread({ threadId })]);

    const { db, threadSessions } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ status: threadSessions.status })
      .from(threadSessions)
      .where(eq(threadSessions.id, sessionId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("canceled");

    await fixture.cleanup();
  });

  it("still cancels a session parked on a delegate", async () => {
    const fixture = await makeFixture("cancel-parked");
    const { threadId, sessionId } = await fixture.thread({ status: "waiting" });
    const { cancelThread } = await import("./supervisor");

    await cancelThread({ threadId });

    const { db, threadSessions } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select({ status: threadSessions.status })
      .from(threadSessions)
      .where(eq(threadSessions.id, sessionId));
    expect(row?.status).toBe("canceled");

    await fixture.cleanup();
  });
});
```

The third test is Review Focus item 1.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @roster/api test finish-once`
Expected: FAIL — `patchLive` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add `notInArray` to the existing `drizzle-orm` import in `supervisor.ts`, then add below `patch`:

```ts
export async function patchLive(
  sessionId: string,
  values: Partial<SelectThreadSession>,
): Promise<SessionView | null> {
  const [row] = await db
    .update(threadSessions)
    .set(values)
    .where(
      and(
        eq(threadSessions.id, sessionId),
        notInArray(threadSessions.status, [...TERMINAL_STATUSES]),
      ),
    )
    .returning({ id: threadSessions.id });
  if (!row) return null;
  return sessionById(row.id);
}
```

`TERMINAL_STATUSES` already exists at `supervisor.ts:73`.

Then change the write in `finishOnce` at `supervisor.ts:784`:

```ts
  const row = await patchLive(args.sessionId, values);
  if (!row) {
    await reportUndelivered(args.sessionId, "that session is gone.", queued);
    return NOTHING_TO_RESUME;
  }
```

Leave the `finishing` Set and the `isTerminal` pre-check alone. They are now a fast path.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @roster/api test finish-once`
Expected: PASS, 3 tests. Run it three times — the race test must be stable, not lucky.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/sessions/supervisor.ts \
        packages/api/src/services/sessions/finish-once.db.test.ts
git commit -m "fix(sessions): let the database decide which finish won

A terminal status is the end of a session's life, but patch() wrote over
it unconditionally, so whichever of two finishes landed second became the
truth — a cancel could be overwritten by a completion that started
earlier. The in-memory finishing Set stays as a fast path against a
duplicate transcript read, but it is no longer what makes this correct."
```

---

### Task 4: One agent message per thing said

`persistAgentMessage` (`supervisor.ts:877`) reads the newest `kind: "agent"` row, compares its text, then inserts with no conflict target. Two callers racing both read "no match" and both insert. `messages_project_client_id_idx` (`roster.ts:125`) already enforces `(project_id, client_id)` — the insert just has to use it, as `postTask` (`task-assignment.ts:107`) does.

**Files:**
- Modify: `packages/api/src/services/sessions/supervisor.ts:877-919`, and its three callers at `:508`, `:769`, `:792`
- Test: `packages/api/src/services/sessions/agent-message-once.db.test.ts`

**Interfaces:**
- Consumes: `makeFixture`, `hasDatabase`, `mock-superset`.
- Produces: `persistAgentMessage` gains a required `sessionId: string` in its argument object.

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/services/sessions/agent-message-once.db.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import "../../test/mock-superset";
import { hasDatabase, makeFixture } from "../../test/fixtures";

async function agentMessages(threadId: string): Promise<number> {
  const { db, messages } = await import("@roster/db");
  const { and, eq } = await import("drizzle-orm");
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.threadId, threadId), eq(messages.kind, "agent")));
  return rows.length;
}

describe.skipIf(!hasDatabase())("what the agent is recorded as saying", () => {
  it("writes one message when two callers say the same thing at once", async () => {
    const fixture = await makeFixture("agent-once");
    const made = await fixture.thread();
    const { persistAgentMessage } = await import("./supervisor");

    const thread = {
      id: made.threadId,
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      rootMessageId: made.rootMessageId,
    };

    await Promise.all([
      persistAgentMessage({ sessionId: made.sessionId, thread, text: "done" }),
      persistAgentMessage({ sessionId: made.sessionId, thread, text: "done" }),
    ]);

    expect(await agentMessages(made.threadId)).toBe(1);
    await fixture.cleanup();
  });

  it("reports whether it was the one that wrote", async () => {
    const fixture = await makeFixture("agent-reports");
    const made = await fixture.thread();
    const { persistAgentMessage } = await import("./supervisor");

    const thread = {
      id: made.threadId,
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      rootMessageId: made.rootMessageId,
    };

    expect(await persistAgentMessage({ sessionId: made.sessionId, thread, text: "first" })).toBe(true);
    expect(await persistAgentMessage({ sessionId: made.sessionId, thread, text: "first" })).toBe(false);

    await fixture.cleanup();
  });

  it("suppresses the same text repeated later in one session", async () => {
    const fixture = await makeFixture("agent-repeat");
    const made = await fixture.thread();
    const { persistAgentMessage } = await import("./supervisor");

    const thread = {
      id: made.threadId,
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      rootMessageId: made.rootMessageId,
    };

    await persistAgentMessage({ sessionId: made.sessionId, thread, text: "same" });
    await persistAgentMessage({ sessionId: made.sessionId, thread, text: "different" });
    expect(await persistAgentMessage({ sessionId: made.sessionId, thread, text: "same" })).toBe(false);

    expect(await agentMessages(made.threadId)).toBe(2);
    await fixture.cleanup();
  });
});
```

The third test is Review Focus item 2. It documents a deliberate widening: today only the immediately previous agent message is compared, so "same" after "different" would be written again. A session-scoped content key suppresses it.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @roster/api test agent-message-once`
Expected: FAIL — the first test finds 2 rows, and TypeScript rejects the unknown `sessionId` property.

- [ ] **Step 3: Write minimal implementation**

Add `import { createHash } from "node:crypto";` to `supervisor.ts`, then change the signature and the insert:

```ts
export async function persistAgentMessage(args: {
  sessionId: string;
  thread: {
    id: string;
    organizationId: string;
    projectId: string;
    rootMessageId: string;
  };
  text: string;
  agentChannelId?: string;
  dedupe?: boolean;
}): Promise<boolean> {
```

```ts
  const clientId =
    args.dedupe === false
      ? null
      : `agent:${args.sessionId}:${createHash("sha256")
          .update(text)
          .digest("base64url")
          .slice(0, 22)}`;
```

Add `clientId` to the inserted values and the conflict clause to the insert:

```ts
    .onConflictDoNothing({ target: [messages.projectId, messages.clientId] })
```

Then pass `sessionId` at the three call sites: `askForInput` (`:508`) already has `sessionId` in scope; both `finishOnce` branches (`:769`, `:792`) pass `sessionId: args.sessionId`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @roster/api test agent-message-once`
Expected: PASS, 3 tests.

Run: `pnpm --filter @roster/api typecheck`
Expected: no errors. A failure names a caller that was missed.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/sessions/supervisor.ts \
        packages/api/src/services/sessions/agent-message-once.db.test.ts
git commit -m "fix(sessions): make the agent-message dedupe atomic

The check was a read followed by an unguarded insert, so two callers
posting the agent's reply at the same moment both saw no match and both
wrote. The reply now carries a client id derived from the session and the
text, which messages_project_client_id_idx already enforces, so the
second insert is a no-op rather than a duplicate in the thread."
```

---

### Task 5: Completing a thread leaves the checkmark on

`completeThread` (`supervisor.ts:1473`) pre-reads for an existing `✅`, then calls `toggleReaction` (`reactions.ts:85`), which *deletes* the row when its insert conflicts. Two racers both see no reaction, both toggle, and the second removes what the first added — a thread marked complete with no checkmark. This one fails today.

**Files:**
- Modify: `packages/api/src/services/reactions.ts`, `packages/api/src/services/sessions/supervisor.ts:1473-1506`
- Test: `packages/api/src/services/reactions.db.test.ts`

**Interfaces:**
- Consumes: `makeFixture`, `hasDatabase`, `mock-superset`.
- Produces: `addReaction(args: { messageId: string; memberId: string; emoji: string }): Promise<{ added: boolean }>` in `reactions.ts` — inserts idempotently and publishes as `toggleReaction` does, but never deletes.

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/services/reactions.db.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import "../test/mock-superset";
import { hasDatabase, makeFixture } from "../test/fixtures";

describe.skipIf(!hasDatabase())("completing a thread", () => {
  it("keeps the reaction when two completions race", async () => {
    const fixture = await makeFixture("complete-race");
    const made = await fixture.thread();
    const { completeThread } = await import("./sessions/supervisor");

    await Promise.all([
      completeThread({ threadId: made.threadId, memberId: fixture.memberId }),
      completeThread({ threadId: made.threadId, memberId: fixture.memberId }),
    ]);

    const { db, reactions } = await import("@roster/db");
    const { and, eq } = await import("drizzle-orm");
    const rows = await db
      .select({ id: reactions.id })
      .from(reactions)
      .where(and(eq(reactions.messageId, made.rootMessageId), eq(reactions.emoji, "✅")));
    expect(rows).toHaveLength(1);

    await fixture.cleanup();
  });

  it("does not throw when the thread is already gone", async () => {
    const fixture = await makeFixture("complete-missing");
    const made = await fixture.thread();
    const { completeThread } = await import("./sessions/supervisor");

    const { db, threads } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");
    await db.delete(threads).where(eq(threads.id, made.threadId));

    await expect(
      completeThread({ threadId: made.threadId, memberId: fixture.memberId }),
    ).resolves.toBeUndefined();

    await fixture.cleanup();
  });
});
```

The second test is Review Focus item 3.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @roster/api test reactions.db`
Expected: FAIL — the racing test finds 0 reactions, because the second toggle deleted the first one's row.

- [ ] **Step 3: Write minimal implementation**

In `reactions.ts`, extract the publish tail of `toggleReaction` (`reactions.ts:118-135`) into a private helper and add `addReaction`:

```ts
async function publishReaction(args: {
  messageId: string;
  memberId: string;
  emoji: string;
  added: boolean;
}): Promise<void> {
  const target = await reactionTarget(args.messageId);
  if (!target) return;

  const payload = reactionPayload({
    messageId: target.id,
    projectId: target.projectId,
    threadId: target.threadId,
    emoji: args.emoji,
    memberId: args.memberId,
    added: args.added,
  });

  const targets = [publish(channelName(target.projectId), payload)];
  if (target.threadId) {
    targets.push(publish(threadChannelName(target.threadId), payload));
  }

  await Promise.all(targets);
}

export async function addReaction(args: {
  messageId: string;
  memberId: string;
  emoji: string;
}): Promise<{ added: boolean }> {
  const inserted = await db
    .insert(reactions)
    .values({
      messageId: args.messageId,
      memberId: args.memberId,
      emoji: args.emoji,
    })
    .onConflictDoNothing({
      target: [reactions.messageId, reactions.memberId, reactions.emoji],
    })
    .returning({ id: reactions.id });

  const added = inserted.length > 0;
  if (added) await publishReaction({ ...args, added });

  return { added };
}
```

Rewrite the tail of `toggleReaction` to `await publishReaction({ ...args, added }); return { added };`.

In `supervisor.ts`, replace the pre-read and toggle in `completeThread` with:

```ts
  await addReaction({
    messageId: thread.rootMessageId,
    memberId: args.memberId,
    emoji: COMPLETE_EMOJI,
  });

  await publishThread(args.threadId);
```

Change the import from `toggleReaction` to `addReaction`, and delete the now-unused `already` query and its `reactions` import if nothing else in the file uses it. The `completedAt` update above already returns no row when the thread is gone, which is what makes the second test pass.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @roster/api test reactions.db`
Expected: PASS, 2 tests.

Run: `pnpm --filter @roster/api test reactions.test`
Expected: PASS, unchanged — the `toggleReaction` refactor must not alter its behaviour.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/reactions.ts \
        packages/api/src/services/sessions/supervisor.ts \
        packages/api/src/services/reactions.db.test.ts
git commit -m "fix(threads): stop a second completion removing the checkmark

completeThread pre-read for the reaction and then called a toggle, so two
completions both found nothing and the second deleted what the first
added — the thread ended up complete with no tick. addReaction inserts
idempotently against the existing unique index and never deletes."
```

---

### Task 6: Settle a delegation exactly once

`settleDelegationFor` (`delegations.ts:275`) reads the open delegation and then updates it with no status predicate, so two racers both write the reply into the parent and both steer it. `writeReplyIntoParent` (`delegations.ts:322`) has no dedupe at all.

**Files:**
- Modify: `packages/api/src/services/delegations.ts:281-295`, `:322-347`
- Test: `packages/api/src/services/delegation-settle.db.test.ts`

**Interfaces:**
- Consumes: `makeFixture`, `hasDatabase`, `mock-superset`.
- Produces: `writeReplyIntoParent` gains `delegationId: string`. It stays module-private.

- [ ] **Step 1: Write the failing test**

Before writing, read `delegate` and `settleDelegationFor` in `packages/api/src/services/delegations.ts` and the `delegations` table in `roster.ts:441` so the inserted row below carries every required column.

Create `packages/api/src/services/delegation-settle.db.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import "../test/mock-superset";
import { hasDatabase, makeFixture } from "../test/fixtures";

describe.skipIf(!hasDatabase())("settling a delegation", () => {
  it("writes one reply when two settles race", async () => {
    const fixture = await makeFixture("settle-race");
    const parent = await fixture.thread();
    const child = await fixture.thread();
    const targetChannelId = await fixture.channel("target");

    const { db, delegations } = await import("@roster/db");
    const [delegation] = await db
      .insert(delegations)
      .values({
        organizationId: fixture.orgId,
        parentThreadId: parent.threadId,
        originChannelId: fixture.projectId,
        targetChannelId,
        childThreadId: child.threadId,
        task: "look at the logs",
        status: "open",
      })
      .returning({ id: delegations.id });

    const { settleDelegationFor } = await import("./delegations");
    await Promise.all([
      settleDelegationFor({ childThreadId: child.threadId, reply: "found it" }),
      settleDelegationFor({ childThreadId: child.threadId, reply: "found it" }),
    ]);

    const { eq, and } = await import("drizzle-orm");
    const [row] = await db
      .select({ status: delegations.status })
      .from(delegations)
      .where(eq(delegations.id, delegation!.id));
    expect(row?.status).toBe("answered");

    const { messages } = await import("@roster/db");
    const replies = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.threadId, parent.threadId), eq(messages.kind, "agent")));
    expect(replies).toHaveLength(1);

    await fixture.cleanup();
  });

  it("still settles when the child was canceled first", async () => {
    const fixture = await makeFixture("settle-canceled");
    const parent = await fixture.thread();
    const child = await fixture.thread();
    const targetChannelId = await fixture.channel("target");

    const { db, delegations, threadSessions } = await import("@roster/db");
    const [delegation] = await db
      .insert(delegations)
      .values({
        organizationId: fixture.orgId,
        parentThreadId: parent.threadId,
        originChannelId: fixture.projectId,
        targetChannelId,
        childThreadId: child.threadId,
        task: "look at the logs",
        status: "open",
      })
      .returning({ id: delegations.id });

    const { eq } = await import("drizzle-orm");
    await db
      .update(threadSessions)
      .set({ status: "canceled" })
      .where(eq(threadSessions.threadId, child.threadId));

    const { settleDelegationFor } = await import("./delegations");
    await settleDelegationFor({ childThreadId: child.threadId, reply: "", failed: true });

    const [row] = await db
      .select({ status: delegations.status })
      .from(delegations)
      .where(eq(delegations.id, delegation!.id));
    expect(row?.status).toBe("failed");

    await fixture.cleanup();
  });
});
```

The second test is Review Focus item 5.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @roster/api test delegation-settle`
Expected: FAIL — the racing test finds 2 replies in the parent thread.

- [ ] **Step 3: Write minimal implementation**

Replace the `findFirst` plus unconditional update in `settleDelegationFor` with a single claiming update, and rename the variable everything below it uses:

```ts
  const [claimed] = await db
    .update(delegations)
    .set({
      status: args.failed ? "failed" : "answered",
      answeredAt: new Date(),
    })
    .where(
      and(
        eq(delegations.childThreadId, args.childThreadId),
        eq(delegations.status, "open"),
      ),
    )
    .returning();
  if (!claimed) return;
```

Then give `writeReplyIntoParent` a `delegationId` and a client id:

```ts
      clientId: `delegation-reply:${args.delegationId}`,
```

with `.onConflictDoNothing({ target: [messages.projectId, messages.clientId] })` on the insert, and `delegationId: claimed.id` at its call site.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @roster/api test delegation-settle`
Expected: PASS, 2 tests.

Run: `pnpm --filter @roster/api test delegation-rest`
Expected: PASS, unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/delegations.ts \
        packages/api/src/services/delegation-settle.db.test.ts
git commit -m "fix(delegations): claim the delegation before answering it

The settle read the open row and then updated it without checking it was
still open, so two settles both wrote the answer into the parent thread
and both steered it — the asking agent heard the reply twice. The update
now claims the row conditionally and the reply carries a client id."
```

---

### Task 7: A rejected delegation leaves no orphan message

`postRequest` (`delegations.ts:210`) inserts the "@x asked: …" message with no `clientId`. When `delegations_one_open_per_parent_idx` (`roster.ts:471`) then rejects the delegation, the message stays behind with nothing pointing at it.

**Files:**
- Modify: `packages/api/src/services/delegations.ts:210-235` and its call site in `delegate`
- Test: `packages/api/src/services/delegation-settle.db.test.ts` (extend)

**Interfaces:**
- Consumes: `makeFixture`, `hasDatabase`, `mock-superset`.
- Produces: `postRequest` gains `dedupeKey: string`, used as the message's `clientId`.

- [ ] **Step 1: Write the failing test**

Read `delegate`'s signature in `packages/api/src/services/delegations.ts` first and match it exactly. Append to `delegation-settle.db.test.ts` a test that calls `delegate` twice concurrently with the same parent thread and task, using `Promise.allSettled` because one call is expected to be rejected, then asserts exactly one message of kind `delegation` exists in the target channel:

```ts
  it("posts one request message when the same ask is made twice", async () => {
    const fixture = await makeFixture("ask-twice");
    const parent = await fixture.thread();
    await fixture.channel("target");

    const { delegate } = await import("./delegations");
    const ask = () =>
      delegate({
        organizationId: fixture.orgId,
        memberId: fixture.memberId,
        role: "owner",
        parentThreadId: parent.threadId,
        targetChannelSlug: "target",
        task: "look at the logs",
      });

    await Promise.allSettled([ask(), ask()]);

    const { db, messages, projects } = await import("@roster/db");
    const { and, eq } = await import("drizzle-orm");
    const [target] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.organizationId, fixture.orgId), eq(projects.slug, "target")));

    const posted = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.projectId, target!.id), eq(messages.kind, "delegation")));
    expect(posted).toHaveLength(1);

    await fixture.cleanup();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @roster/api test delegation-settle`
Expected: FAIL — two `delegation` messages exist, one orphaned.

- [ ] **Step 3: Write minimal implementation**

Give `postRequest` a `dedupeKey: string` field, set it as `clientId`, add `.onConflictDoNothing({ target: [messages.projectId, messages.clientId] })`, and fall back to reading the existing row rather than throwing — the same shape `postTask` uses at `task-assignment.ts:110-124`:

```ts
  if (row) return row.id;

  const [existing] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.projectId, args.targetChannelId),
        eq(messages.clientId, args.dedupeKey),
      ),
    )
    .limit(1);

  if (!existing) throw new Error("Could not post the request.");
  return existing.id;
```

At the call site, build the key from the parent thread and the task text, which is what makes two identical simultaneous asks collapse:

```ts
    dedupeKey: `delegation-request:${args.parentThreadId}:${createHash("sha256")
      .update(args.task)
      .digest("base64url")
      .slice(0, 22)}`,
```

`createHash` is already imported by Task 6's work in this file; if not, add `import { createHash } from "node:crypto";`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @roster/api test delegation-settle`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/delegations.ts \
        packages/api/src/services/delegation-settle.db.test.ts
git commit -m "fix(delegations): do not leave the request message behind

The request was posted before the delegation row, so when the one-open-
per-parent index rejected the delegation the message stayed in the target
channel with nothing pointing at it. A client id derived from the parent
thread and the task makes the second post resolve to the first."
```

---

### Task 8: Notifications with no message must not duplicate

`deliver` (`notifications.ts:163`) relies on `onConflictDoNothing` against `(member_id, message_id) where message_id is not null` (`roster.ts:529`). `notifyThreadFailed` (`:307`) and `notifyDelegationReceived` (`:353`) both pass `messageId: null`, so they fall outside that index and duplicate freely.

**Files:**
- Modify: `packages/db/src/schema/roster.ts` (the `notifications` table), `packages/api/src/services/notifications.ts:163-192`, `packages/api/src/services/sessions/supervisor.ts:802`, `packages/api/src/services/delegations.ts:182`
- Create: a migration via `pnpm db:generate`
- Test: `packages/api/src/services/notification-dedupe.db.test.ts`

**Interfaces:**
- Consumes: `makeFixture`, `hasDatabase`, `mock-superset`.
- Produces: `Delivery` gains `dedupeKey: string | null`; `notifyThreadFailed` gains `sessionId: string`; `notifyDelegationReceived` gains `delegationId: string`.

- [ ] **Step 1: Write the failing test**

`deliver` only writes for subscribers, so the test must subscribe the member first. Read `ensureThreadSubscription` in `packages/api/src/services/notifications.ts:64` for its exact signature.

Create `packages/api/src/services/notification-dedupe.db.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import "../test/mock-superset";
import { hasDatabase, makeFixture } from "../test/fixtures";

async function failureCount(threadId: string): Promise<number> {
  const { db, notifications } = await import("@roster/db");
  const { and, eq } = await import("drizzle-orm");
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.threadId, threadId), eq(notifications.type, "agent_failed")));
  return rows.length;
}

describe.skipIf(!hasDatabase())("notifying without a message", () => {
  it("writes one failure notification when two arrive for one session", async () => {
    const fixture = await makeFixture("notify-once");
    const made = await fixture.thread();
    const { ensureThreadSubscription, notifyThreadFailed } = await import("./notifications");

    await ensureThreadSubscription({
      threadId: made.threadId,
      memberId: fixture.memberId,
      reason: "author",
    });

    await Promise.all([
      notifyThreadFailed({ threadId: made.threadId, sessionId: made.sessionId, reason: "boom" }),
      notifyThreadFailed({ threadId: made.threadId, sessionId: made.sessionId, reason: "boom" }),
    ]);

    expect(await failureCount(made.threadId)).toBe(1);
    await fixture.cleanup();
  });

  it("keeps notifications for two different sessions apart", async () => {
    const fixture = await makeFixture("notify-two");
    const made = await fixture.thread();
    const other = await fixture.thread();
    const { ensureThreadSubscription, notifyThreadFailed } = await import("./notifications");

    await ensureThreadSubscription({
      threadId: made.threadId,
      memberId: fixture.memberId,
      reason: "author",
    });

    await notifyThreadFailed({ threadId: made.threadId, sessionId: made.sessionId, reason: "one" });
    await notifyThreadFailed({ threadId: made.threadId, sessionId: other.sessionId, reason: "two" });

    expect(await failureCount(made.threadId)).toBe(2);
    await fixture.cleanup();
  });
});
```

The second test is Review Focus item 4 — a key of just `failed` per member would make this return 1 and silently swallow the second session's failure.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @roster/api test notification-dedupe`
Expected: FAIL — the first test finds 2 rows, and TypeScript rejects `sessionId`.

- [ ] **Step 3: Write minimal implementation**

In `packages/db/src/schema/roster.ts`, add to the `notifications` columns:

```ts
    dedupeKey: text("dedupe_key"),
```

and to its table config array:

```ts
    uniqueIndex("notifications_member_dedupe_idx")
      .on(table.memberId, table.dedupeKey)
      .where(sql`dedupe_key is not null`),
```

Generate the migration:

```bash
pnpm db:generate
```

In `notifications.ts`, add `dedupeKey: string | null` to `Delivery`, include it in the inserted values, and branch the conflict target — one statement cannot carry two:

```ts
  const created =
    delivery.messageId === null
      ? await db
          .insert(notifications)
          .values(values)
          .onConflictDoNothing({
            target: [notifications.memberId, notifications.dedupeKey],
            where: sql`dedupe_key is not null`,
          })
          .returning(returning)
      : await db
          .insert(notifications)
          .values(values)
          .onConflictDoNothing({
            target: [notifications.memberId, notifications.messageId],
            where: sql`message_id is not null`,
          })
          .returning(returning);
```

where `values` and `returning` are the arrays and column maps lifted out of the current call so both branches share them.

Give `notifyThreadFailed` a `sessionId: string` field and pass `dedupeKey: \`failed:${args.sessionId}\``. Give `notifyDelegationReceived` a `delegationId: string` field and pass `dedupeKey: \`delegation:${args.delegationId}\``. Every other `deliver` call passes `dedupeKey: null`.

Update the caller at `supervisor.ts:802` to pass `sessionId: args.sessionId`, and the caller at `delegations.ts:182` to pass the delegation row's id.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @roster/api test notification-dedupe`
Expected: PASS, 2 tests.

Run: `pnpm --filter @roster/api typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/roster.ts packages/db/drizzle \
        packages/api/src/services/notifications.ts \
        packages/api/src/services/sessions/supervisor.ts \
        packages/api/src/services/delegations.ts \
        packages/api/src/services/notification-dedupe.db.test.ts
git commit -m "fix(notifications): dedupe the ones that carry no message

The unique index only covers notifications with a message id, so the two
paths that pass null — a failed session and a received delegation — could
write the same notification twice. A dedupe key scoped to the session or
the delegation closes it without merging notifications that belong to
different sessions."
```

---

### Task 9: Whole-step verification

**Files:** none modified, unless a check fails.

- [ ] **Step 1: Run the full suite**

Run: `pnpm test`
Expected: PASS across every package.

- [ ] **Step 2: Typecheck everything**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Confirm the migration applies to a fresh database**

```bash
pnpm dev:db:stop
docker volume rm roster-pgdata
pnpm dev:db
pnpm --filter @roster/db push
```

Expected: `notifications.dedupe_key` and `notifications_member_dedupe_idx` both exist. Check with `pnpm db:studio`.

- [ ] **Step 4: Confirm the migration also applies on top of an existing database**

Restore a database that predates this branch (or re-run `pnpm db:push` from `main`, then switch back) and boot the app. `migrateToLatest` (`packages/db/src/migrate.ts:122`) runs on first request.
Expected: the new column and index appear with no error, and no existing migration is re-applied.

- [ ] **Step 5: Commit anything outstanding**

```bash
git status
```

Expected: clean. If a generated migration is untracked, commit it.

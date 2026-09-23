import { describe, expect, it } from "vitest";

import "../test/mock-superset";
import { hasDatabase, makeFixture } from "../test/fixtures";

async function failureCount(threadId: string): Promise<number> {
  const { db, notifications } = await import("@roster/db");
  const { and, eq } = await import("drizzle-orm");
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.threadId, threadId),
        eq(notifications.type, "agent_failed"),
      ),
    );
  return rows.length;
}

describe.skipIf(!hasDatabase())("notifying without a message", () => {
  it("writes one failure notification when two arrive for one session", async () => {
    const fixture = await makeFixture("notifyonce");
    const made = await fixture.thread();
    const { ensureThreadSubscription, notifyThreadFailed } = await import(
      "./notifications"
    );

    await ensureThreadSubscription({
      threadId: made.threadId,
      memberId: fixture.memberId,
      reason: "author",
    });

    await Promise.all([
      notifyThreadFailed({
        threadId: made.threadId,
        sessionId: made.sessionId,
        reason: "boom",
      }),
      notifyThreadFailed({
        threadId: made.threadId,
        sessionId: made.sessionId,
        reason: "boom",
      }),
    ]);

    expect(await failureCount(made.threadId)).toBe(1);

    await fixture.cleanup();
  });

  it("keeps notifications for two different sessions apart", async () => {
    const fixture = await makeFixture("notifytwo");
    const made = await fixture.thread();
    const other = await fixture.thread();
    const { ensureThreadSubscription, notifyThreadFailed } = await import(
      "./notifications"
    );

    await ensureThreadSubscription({
      threadId: made.threadId,
      memberId: fixture.memberId,
      reason: "author",
    });

    await notifyThreadFailed({
      threadId: made.threadId,
      sessionId: made.sessionId,
      reason: "one",
    });
    await notifyThreadFailed({
      threadId: made.threadId,
      sessionId: other.sessionId,
      reason: "two",
    });

    expect(await failureCount(made.threadId)).toBe(2);

    await fixture.cleanup();
  });
});

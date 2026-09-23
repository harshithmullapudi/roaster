import { describe, expect, it } from "vitest";

import "../test/mock-superset";
import { hasDatabase, makeFixture } from "../test/fixtures";

async function checkmarks(messageId: string): Promise<number> {
  const { db, reactions } = await import("@roster/db");
  const { and, eq } = await import("drizzle-orm");
  const rows = await db
    .select({ id: reactions.id })
    .from(reactions)
    .where(and(eq(reactions.messageId, messageId), eq(reactions.emoji, "✅")));
  return rows.length;
}

describe.skipIf(!hasDatabase())("completing a thread", () => {
  it("keeps the reaction when two completions race", async () => {
    const fixture = await makeFixture("completerace");
    const made = await fixture.thread();
    const { completeThread } = await import("./sessions/supervisor");

    await Promise.all([
      completeThread({ threadId: made.threadId, memberId: fixture.memberId }),
      completeThread({ threadId: made.threadId, memberId: fixture.memberId }),
    ]);

    expect(await checkmarks(made.rootMessageId)).toBe(1);

    await fixture.cleanup();
  });

  it("leaves one reaction when completed twice in sequence", async () => {
    const fixture = await makeFixture("completetwice");
    const made = await fixture.thread();
    const { completeThread } = await import("./sessions/supervisor");

    await completeThread({ threadId: made.threadId, memberId: fixture.memberId });
    await completeThread({ threadId: made.threadId, memberId: fixture.memberId });

    expect(await checkmarks(made.rootMessageId)).toBe(1);

    await fixture.cleanup();
  });

  it("does not throw when the thread is already gone", async () => {
    const fixture = await makeFixture("completemissing");
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

import { describe, expect, it } from "vitest";

import "../../test/mock-superset";
import { hasDatabase, makeFixture } from "../../test/fixtures";

async function statusOf(sessionId: string): Promise<string | undefined> {
  const { db, threadSessions } = await import("@roster/db");
  const { eq } = await import("drizzle-orm");
  const [row] = await db
    .select({ status: threadSessions.status })
    .from(threadSessions)
    .where(eq(threadSessions.id, sessionId));
  return row?.status;
}

describe.skipIf(!hasDatabase())("finishing a session", () => {
  it("refuses to patch a session that already ended", async () => {
    const fixture = await makeFixture("patchlive");
    const made = await fixture.thread();
    const { patchLive } = await import("./supervisor");

    const first = await patchLive(made.sessionId, { status: "completed" });
    expect(first?.status).toBe("completed");

    expect(await patchLive(made.sessionId, { status: "failed" })).toBeNull();
    expect(await statusOf(made.sessionId)).toBe("completed");

    await fixture.cleanup();
  });

  it("returns null for a session that does not exist", async () => {
    const { randomUUID } = await import("node:crypto");
    const { patchLive } = await import("./supervisor");

    expect(await patchLive(randomUUID(), { status: "failed" })).toBeNull();
  });

  it("keeps the first terminal status when two cancels race", async () => {
    const fixture = await makeFixture("cancelrace");
    const made = await fixture.thread();
    const { cancelThread } = await import("./supervisor");

    await Promise.all([
      cancelThread({ threadId: made.threadId }),
      cancelThread({ threadId: made.threadId }),
    ]);

    expect(await statusOf(made.sessionId)).toBe("canceled");

    await fixture.cleanup();
  });

  it("writes a session parked on a delegate, which is not terminal", async () => {
    const fixture = await makeFixture("patchparked");
    const made = await fixture.thread({ status: "waiting" });
    const { patchLive } = await import("./supervisor");

    const row = await patchLive(made.sessionId, { status: "canceled" });
    expect(row?.status).toBe("canceled");

    await fixture.cleanup();
  });
});

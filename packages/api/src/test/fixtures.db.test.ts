import { describe, expect, it } from "vitest";

import { hasDatabase, makeFixture } from "./fixtures";

describe.skipIf(!hasDatabase())("the database fixture", () => {
  it("builds a channel with threads and cleans itself up", async () => {
    const fixture = await makeFixture("fixture-self");
    const first = await fixture.thread();
    const second = await fixture.thread({ status: "waiting" });

    expect(first.threadId).not.toBe(second.threadId);
    expect(first.projectId).toBe(fixture.projectId);

    const { db, organizations, threadSessions } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");

    const [session] = await db
      .select({ status: threadSessions.status })
      .from(threadSessions)
      .where(eq(threadSessions.id, second.sessionId));
    expect(session?.status).toBe("waiting");

    const other = await fixture.channel("second");
    expect(other).not.toBe(fixture.projectId);

    await fixture.cleanup();

    const left = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, fixture.orgId));
    expect(left).toHaveLength(0);
  });
});

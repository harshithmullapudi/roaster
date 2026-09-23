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
    const fixture = await makeFixture("agentonce");
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
    const fixture = await makeFixture("agentreports");
    const made = await fixture.thread();
    const { persistAgentMessage } = await import("./supervisor");

    const thread = {
      id: made.threadId,
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      rootMessageId: made.rootMessageId,
    };

    expect(
      await persistAgentMessage({ sessionId: made.sessionId, thread, text: "first" }),
    ).toBe(true);
    expect(
      await persistAgentMessage({ sessionId: made.sessionId, thread, text: "first" }),
    ).toBe(false);

    await fixture.cleanup();
  });

  it("suppresses the same text repeated later in one session", async () => {
    const fixture = await makeFixture("agentrepeat");
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
    expect(
      await persistAgentMessage({ sessionId: made.sessionId, thread, text: "same" }),
    ).toBe(false);

    expect(await agentMessages(made.threadId)).toBe(2);

    await fixture.cleanup();
  });
});

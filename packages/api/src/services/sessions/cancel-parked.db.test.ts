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

async function delegationStatus(id: string): Promise<string | undefined> {
  const { db, delegations } = await import("@roster/db");
  const { eq } = await import("drizzle-orm");
  const [row] = await db
    .select({ status: delegations.status })
    .from(delegations)
    .where(eq(delegations.id, id));
  return row?.status;
}

async function openDelegation(args: {
  orgId: string;
  parentThreadId: string;
  originMemberId: string;
  targetMemberId: string;
  childThreadId: string;
  depth?: number;
}): Promise<string> {
  const { db, delegations } = await import("@roster/db");
  const [row] = await db
    .insert(delegations)
    .values({
      organizationId: args.orgId,
      parentThreadId: args.parentThreadId,
      originMemberId: args.originMemberId,
      targetMemberId: args.targetMemberId,
      childThreadId: args.childThreadId,
      task: "look at the logs",
      status: "open",
      depth: args.depth ?? 1,
    })
    .returning({ id: delegations.id });
  return row!.id;
}

describe.skipIf(!hasDatabase())("cancelling a thread waiting on a delegate", () => {
  it("ends the parked session and closes the delegation", async () => {
    const fixture = await makeFixture("cancelparked");
    const parent = await fixture.thread({ status: "waiting" });
    const child = await fixture.thread();
    const targetChannelId = await fixture.channel("target");

    const delegationId = await openDelegation({
      orgId: fixture.orgId,
      parentThreadId: parent.threadId,
      originMemberId: fixture.agentFor(),
      targetMemberId: fixture.agentFor(targetChannelId),
      childThreadId: child.threadId,
    });

    const { cancelThread } = await import("./supervisor");
    expect(await cancelThread({ threadId: parent.threadId })).toBe(true);

    expect(await statusOf(parent.sessionId)).toBe("canceled");
    expect(await delegationStatus(delegationId)).toBe("canceled");

    await fixture.cleanup();
  });

  it("cancels the child doing the work", async () => {
    const fixture = await makeFixture("cancelchild");
    const parent = await fixture.thread({ status: "waiting" });
    const child = await fixture.thread();
    const targetChannelId = await fixture.channel("target");

    await openDelegation({
      orgId: fixture.orgId,
      parentThreadId: parent.threadId,
      originMemberId: fixture.agentFor(),
      targetMemberId: fixture.agentFor(targetChannelId),
      childThreadId: child.threadId,
    });

    const { cancelThread } = await import("./supervisor");
    await cancelThread({ threadId: parent.threadId });

    expect(await statusOf(child.sessionId)).toBe("canceled");

    await fixture.cleanup();
  });

  it("cancels a grandchild too", async () => {
    const fixture = await makeFixture("cancelgrandchild");
    const parent = await fixture.thread({ status: "waiting" });
    const child = await fixture.thread({ status: "waiting" });
    const grandchild = await fixture.thread();
    const targetChannelId = await fixture.channel("target");

    await openDelegation({
      orgId: fixture.orgId,
      parentThreadId: parent.threadId,
      originMemberId: fixture.agentFor(),
      targetMemberId: fixture.agentFor(targetChannelId),
      childThreadId: child.threadId,
    });
    await openDelegation({
      orgId: fixture.orgId,
      parentThreadId: child.threadId,
      originMemberId: fixture.agentFor(),
      targetMemberId: fixture.agentFor(targetChannelId),
      childThreadId: grandchild.threadId,
      depth: 2,
    });

    const { cancelThread } = await import("./supervisor");
    await cancelThread({ threadId: parent.threadId });

    expect(await statusOf(child.sessionId)).toBe("canceled");
    expect(await statusOf(grandchild.sessionId)).toBe("canceled");

    await fixture.cleanup();
  });

  it("does not revive the parent when a settle arrives afterwards", async () => {
    const fixture = await makeFixture("cancelnorevive");
    const parent = await fixture.thread({ status: "waiting" });
    const child = await fixture.thread();
    const targetChannelId = await fixture.channel("target");

    await openDelegation({
      orgId: fixture.orgId,
      parentThreadId: parent.threadId,
      originMemberId: fixture.agentFor(),
      targetMemberId: fixture.agentFor(targetChannelId),
      childThreadId: child.threadId,
    });

    const { cancelThread } = await import("./supervisor");
    await cancelThread({ threadId: parent.threadId });

    const { settleDelegationFor } = await import("../delegations");
    await settleDelegationFor({
      threadId: child.threadId,
      reply: "here is the answer",
    });

    expect(await statusOf(parent.sessionId)).toBe("canceled");

    const { db, messages } = await import("@roster/db");
    const { and, eq } = await import("drizzle-orm");
    const replies = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(eq(messages.threadId, parent.threadId), eq(messages.kind, "agent")),
      );
    expect(replies).toHaveLength(0);

    await fixture.cleanup();
  });

  it("still settles the parent when the child is the one cancelled", async () => {
    const fixture = await makeFixture("cancelchildside");
    const parent = await fixture.thread({ status: "waiting" });
    const child = await fixture.thread();
    const targetChannelId = await fixture.channel("target");

    const delegationId = await openDelegation({
      orgId: fixture.orgId,
      parentThreadId: parent.threadId,
      originMemberId: fixture.agentFor(),
      targetMemberId: fixture.agentFor(targetChannelId),
      childThreadId: child.threadId,
    });

    const { cancelThread } = await import("./supervisor");
    await cancelThread({ threadId: child.threadId });

    expect(await delegationStatus(delegationId)).toBe("failed");

    await fixture.cleanup();
  });
});

import { beforeAll, describe, expect, it, vi } from "vitest";

import { hasDatabase, makeFixture } from "../test/fixtures";
import "../test/mock-superset";

/*
 * Asking an agent on your own channel is the whole point of agents being
 * members: it joins the thread you are already in and works in the worktree
 * that thread already has, rather than cutting one of its own. Asking an
 * agent elsewhere must keep doing what it always did.
 */
describe.skipIf(!hasDatabase())("asking an agent on your own channel", () => {
  let superset: typeof import("@roster/superset");
  let delegations: typeof import("./delegations");
  let agents: typeof import("./agents");

  beforeAll(async () => {
    superset = await import("@roster/superset");
    delegations = await import("./delegations");
    agents = await import("./agents");
  });

  it("runs it in the thread's worktree, with its brief in the prompt", async () => {
    const fixture = await makeFixture("sharewt");
    const parent = await fixture.thread();

    const pm = await agents.createAgent({
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      name: "pm",
      brief: "Own the spec. Ask about scope, not syntax.",
    });

    vi.mocked(superset.createWorkspace).mockClear();
    vi.mocked(superset.runAgent).mockClear();

    const result = await delegations.delegate({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      role: "owner",
      parentThreadId: parent.threadId,
      handle: pm.handle,
      task: "scope the onboarding change",
    });

    expect(result.sameWorktree).toBe(true);
    expect(result.childThreadId).toBeNull();

    // No second worktree was cut.
    expect(vi.mocked(superset.createWorkspace)).not.toHaveBeenCalled();

    const run = vi.mocked(superset.runAgent).mock.calls[0]?.[0];
    expect(run?.workspaceId).toBe("workspace-1");
    expect(run?.prompt).toContain("Own the spec. Ask about scope, not syntax.");
    expect(run?.prompt).toContain(`You are @${pm.handle}`);
    expect(run?.prompt).toContain("scope the onboarding change");

    const { db, threadSessions } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");
    const sessions = await db
      .select()
      .from(threadSessions)
      .where(eq(threadSessions.threadId, parent.threadId));

    expect(sessions).toHaveLength(2);
    const joined = sessions.find((row) => row.agentMemberId === pm.id);
    expect(joined?.role).toBe("delegate");
    expect(joined?.supersetWorkspaceId).toBe("workspace-1");

    await fixture.cleanup();
  });

  it("parks the asking agent and wakes it with the answer", async () => {
    const fixture = await makeFixture("shareanswer");
    const parent = await fixture.thread();

    const pm = await agents.createAgent({
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      name: "pm",
    });

    await delegations.delegate({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      role: "owner",
      parentThreadId: parent.threadId,
      handle: pm.handle,
      task: "scope it",
    });

    const { db, messages, threadSessions } = await import("@roster/db");
    const { and, eq } = await import("drizzle-orm");

    const asker = await db.query.threadSessions.findFirst({
      where: and(
        eq(threadSessions.threadId, parent.threadId),
        eq(threadSessions.role, "main"),
      ),
    });
    expect(asker?.status).toBe("waiting");

    await delegations.settleDelegationFor({
      threadId: parent.threadId,
      agentMemberId: pm.id,
      reply: "three screens, one migration",
    });

    const written = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.threadId, parent.threadId),
          eq(messages.authorMemberId, pm.id),
          eq(messages.kind, "agent"),
        ),
      );

    expect(written.map((row) => row.text)).toContain(
      "three screens, one migration",
    );

    const { delegations: table } = await import("@roster/db");
    const settled = await db.query.delegations.findFirst({
      where: eq(table.parentThreadId, parent.threadId),
    });
    expect(settled?.status).toBe("answered");
    expect(settled?.childThreadId).toBeNull();
    expect(settled?.targetMemberId).toBe(pm.id);

    await fixture.cleanup();
  });

  it("deletes a shared worktree once, not once per agent", async () => {
    const fixture = await makeFixture("sharereap");
    const parent = await fixture.thread();

    const pm = await agents.createAgent({
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      name: "pm",
    });

    await delegations.delegate({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      role: "owner",
      parentThreadId: parent.threadId,
      handle: pm.handle,
      task: "scope it",
    });

    vi.mocked(superset.deleteWorkspace).mockClear();

    const { reapThread, assertReaped } = await import("./sessions/supervisor");
    await reapThread({ threadId: parent.threadId });

    expect(vi.mocked(superset.deleteWorkspace)).toHaveBeenCalledTimes(1);

    // Both sessions must be marked, or the thread looks like it leaked one.
    await expect(
      assertReaped({ threadId: parent.threadId }),
    ).resolves.toBeUndefined();

    await fixture.cleanup();
  });

  it("signs what an agent says with that agent, not the channel", async () => {
    const fixture = await makeFixture("whospoke");
    const made = await fixture.thread();

    const pm = await agents.createAgent({
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      name: "pm",
    });

    const { persistAgentMessage } = await import("./sessions/supervisor");
    const { db, messages, threads } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");

    const thread = (await db.query.threads.findFirst({
      where: eq(threads.id, made.threadId),
    }))!;

    await persistAgentMessage({
      sessionId: made.sessionId,
      thread,
      text: "the channel's own agent speaking",
      agentMemberId: fixture.agentFor(),
    });
    await persistAgentMessage({
      sessionId: made.sessionId,
      thread,
      text: "the pm speaking",
      agentMemberId: pm.id,
    });

    const written = await db
      .select({ text: messages.text, author: messages.authorMemberId })
      .from(messages)
      .where(eq(messages.threadId, made.threadId))
      .orderBy(messages.seq);

    expect(
      written.find((row) => row.text === "the pm speaking")?.author,
    ).toBe(pm.id);
    expect(
      written.find((row) => row.text === "the channel's own agent speaking")
        ?.author,
    ).toBe(fixture.agentFor());

    await fixture.cleanup();
  });

  it("still cuts a fresh worktree for an agent on another channel", async () => {
    const fixture = await makeFixture("othercwd");
    const parent = await fixture.thread();
    const other = await fixture.channel("othercwd-design");

    vi.mocked(superset.createWorkspace).mockClear();

    const result = await delegations.delegate({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      role: "owner",
      parentThreadId: parent.threadId,
      handle: "agent-othercwd-design",
      task: "review the empty states",
    });

    expect(result.sameWorktree).toBe(false);
    expect(result.childThreadId).not.toBeNull();
    expect(vi.mocked(superset.createWorkspace)).toHaveBeenCalledTimes(1);

    await fixture.cleanup();
  });

  it("refuses to let an agent ask itself", async () => {
    const fixture = await makeFixture("selfask");
    const parent = await fixture.thread();

    await expect(
      delegations.delegate({
        organizationId: fixture.orgId,
        memberId: fixture.memberId,
        role: "owner",
        parentThreadId: parent.threadId,
        handle: "agent-selfask",
        task: "do it",
      }),
    ).rejects.toThrow(/just do the work/);

    await fixture.cleanup();
  });
});

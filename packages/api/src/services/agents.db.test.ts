import { beforeAll, describe, expect, it } from "vitest";

import { hasDatabase, makeFixture } from "../test/fixtures";

/*
 * Agents are members, so their names live in the same namespace people's do.
 * That is the whole reason a channel can hold several of them without two
 * ever computing the same handle, and it is worth proving against the index
 * that enforces it rather than against a stub.
 */
describe.skipIf(!hasDatabase())("agents under a channel", () => {
  let agents: typeof import("./agents");

  beforeAll(async () => {
    agents = await import("./agents");
  });

  it("names a new agent under the channel's own handle", async () => {
    const fixture = await makeFixture("agentname");

    const made = await agents.createAgent({
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      name: "pm",
      brief: "Own the spec.",
    });

    expect(made.handle).toBe("agent-agentname-pm");
    expect(made.brief).toBe("Own the spec.");

    await fixture.cleanup();
  });

  it("does not stutter when the name already carries the channel", async () => {
    const fixture = await makeFixture("stutter");

    const made = await agents.createAgent({
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      name: "agent-stutter-qa",
    });

    expect(made.handle).toBe("agent-stutter-qa");

    await fixture.cleanup();
  });

  it("reaches the same agent when the same name is asked for twice", async () => {
    const fixture = await makeFixture("twice");

    const first = await agents.createAgent({
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      name: "pm",
      brief: "Own the spec.",
    });
    const again = await agents.createAgent({
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      name: "pm",
    });

    expect(again.id).toBe(first.id);
    expect(again.brief).toBe("Own the spec.");

    await fixture.cleanup();
  });

  it("refuses a name another channel already answers to", async () => {
    const fixture = await makeFixture("clash");
    const other = await fixture.channel("clash-other");

    // The handle "pm" on #clash would resolve to, and this channel already has.
    await fixture.agent(other, "agent-clash-pm");

    await expect(
      agents.createAgent({
        organizationId: fixture.orgId,
        projectId: fixture.projectId,
        name: "pm",
      }),
    ).rejects.toThrow(/taken/);

    await fixture.cleanup();
  });

  it("resolves a handle however it was typed", async () => {
    const fixture = await makeFixture("resolve");
    await agents.createAgent({
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      name: "pm",
    });

    const found = await agents.resolveAgent({
      organizationId: fixture.orgId,
      handle: "@Agent-Resolve-PM",
    });

    expect(found?.handle).toBe("agent-resolve-pm");

    await fixture.cleanup();
  });

  it("stops listing an archived agent but keeps its row", async () => {
    const fixture = await makeFixture("archive");
    const made = await agents.createAgent({
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      name: "reviewer",
    });

    await agents.archiveAgent(made.id);

    const listed = await agents.listAgents({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      role: "owner",
    });

    expect(listed.map((agent) => agent.handle)).not.toContain(made.handle);

    const { db, members } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");
    const row = await db.query.members.findFirst({
      where: eq(members.id, made.id),
    });
    expect(row).toBeDefined();

    await fixture.cleanup();
  });

  it("gives a channel that has none an agent named for its adder", async () => {
    const fixture = await makeFixture("ensure");
    const bare = await fixture.channel("ensure-bare");

    const { db, members } = await import("@roster/db");
    const { and, eq } = await import("drizzle-orm");
    await db
      .delete(members)
      .where(and(eq(members.projectId, bare), eq(members.type, "agent")));

    const made = await agents.ensureChannelAgent({
      organizationId: fixture.orgId,
      projectId: bare,
      slug: "ensure-bare",
      ownerAgentName: "fern",
    });

    expect(made.handle).toBe("fern-ensure-bare");

    await fixture.cleanup();
  });
});

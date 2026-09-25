import { beforeAll, describe, expect, it } from "vitest";

import { hasDatabase, makeFixture } from "../test/fixtures";

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

    expect(made.handle).toBe("agentname-pm");
    expect(made.brief).toBe("Own the spec.");

    await fixture.cleanup();
  });

  it("does not stutter when the name already carries the channel", async () => {
    const fixture = await makeFixture("stutter");

    const made = await agents.createAgent({
      organizationId: fixture.orgId,
      projectId: fixture.projectId,
      name: "stutter-qa",
    });

    expect(made.handle).toBe("stutter-qa");

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

    await fixture.agent(other, "clash-pm");

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
      handle: "@Resolve-PM",
    });

    expect(found?.handle).toBe("resolve-pm");

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

  it("refuses to archive the agent a channel answers as", async () => {
    const fixture = await makeFixture("lastagent");

    const main = await agents.mainAgentFor(fixture.projectId);
    expect(main?.main).toBe(true);

    await expect(agents.archiveAgent(main!.id)).rejects.toThrow(
      /channel's own agent/,
    );

    await fixture.cleanup();
  });

  it("gives a channel that has none an agent named for the channel", async () => {
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
    });

    expect(made.handle).toBe("ensure-bare");

    await fixture.cleanup();
  });
});

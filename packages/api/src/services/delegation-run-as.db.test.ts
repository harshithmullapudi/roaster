import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { runSessionsInThisProcess } from "./sessions/dispatch";
import { hasDatabase, makeFixture } from "../test/fixtures";

runSessionsInThisProcess();

vi.mock("@roster/superset", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@roster/superset")>();

  return {
    ...actual,
    mintJwt: vi.fn(async () => ({
      jwt: "jwt",
      claims: { exp: Math.floor(Date.now() / 1000) + 3600 },
    })),
    createWorkspace: vi.fn(async () => ({
      id: "workspace-1",
      path: "/tmp/workspace-1",
    })),
    runAgent: vi.fn(async () => ({ sessionId: "terminal-1" })),
    readTranscript: vi.fn(async () => ({
      terminalId: "terminal-1",
      text: "",
      source: "harness" as const,
      streamBytes: 0,
    })),
    listAgentBindings: vi.fn(async () => []),
    deleteWorkspace: vi.fn(async () => undefined),
    clearWorkspaceStatuses: vi.fn(async () => undefined),
    interruptAgent: vi.fn(async () => undefined),
    sendToAgent: vi.fn(async () => undefined),
  };
});

async function connectSuperset(memberId: string, supersetOrgId: string) {
  const { db, members } = await import("@roster/db");
  const { eq } = await import("drizzle-orm");
  const { encryptApiKey } = await import("@roster/superset");

  await db
    .update(members)
    .set({ supersetOrgId, supersetKeyEncrypted: encryptApiKey("sk-test") })
    .where(eq(members.id, memberId));
}

async function addTeammate(
  orgId: string,
): Promise<{ memberId: string; userId: string }> {
  const { db, members, users } = await import("@roster/db");

  const userId = randomUUID();
  const memberId = randomUUID();

  await db.insert(users).values({
    id: userId,
    name: "Teammate",
    email: `${userId}@example.test`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(members).values({
    id: memberId,
    organizationId: orgId,
    userId,
    role: "member",
    agentName: "teammate",
    createdAt: new Date(),
  });

  return { memberId, userId };
}

async function addChannelOwnedBy(args: {
  orgId: string;
  slug: string;
  memberId: string;
}): Promise<string> {
  const { db, members, projects } = await import("@roster/db");

  const id = randomUUID();
  await db.insert(projects).values({
    id,
    organizationId: args.orgId,
    supersetProjectId: `superset-${args.slug}-${id.slice(0, 8)}`,
    supersetHostId: "host-2",
    supersetOrgId: args.orgId,
    name: args.slug,
    slug: args.slug,
    addedByMemberId: args.memberId,
  });

  await db.insert(members).values({
    organizationId: args.orgId,
    userId: null,
    role: "member",
    type: "agent",
    agentName: args.slug,
    projectId: id,
    createdAt: new Date(),
  });

  return id;
}

async function sessionOf(threadId: string) {
  const { db, threadSessions } = await import("@roster/db");
  const { eq } = await import("drizzle-orm");
  const [row] = await db
    .select({
      status: threadSessions.status,
      runAsMemberId: threadSessions.runAsMemberId,
      error: threadSessions.error,
    })
    .from(threadSessions)
    .where(eq(threadSessions.threadId, threadId));
  return row;
}

async function agentRepliesIn(threadId: string): Promise<string[]> {
  const { db, messages } = await import("@roster/db");
  const { and, eq } = await import("drizzle-orm");
  const rows = await db
    .select({ text: messages.text })
    .from(messages)
    .where(and(eq(messages.threadId, threadId), eq(messages.kind, "agent")));
  return rows.map((row) => row.text ?? "");
}

describe.skipIf(!hasDatabase())("a delegated run", () => {
  it("runs as the member whose machine the answering channel lives on", async () => {
    const fixture = await makeFixture("runas");
    await connectSuperset(fixture.memberId, fixture.orgId);

    const owner = await addTeammate(fixture.orgId);
    await connectSuperset(owner.memberId, fixture.orgId);
    await addChannelOwnedBy({
      orgId: fixture.orgId,
      slug: "target",
      memberId: owner.memberId,
    });

    const parent = await fixture.thread();

    const { delegate } = await import("./delegations");
    const result = await delegate({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      role: "owner",
      parentThreadId: parent.threadId,
      handle: "target",
      task: "look at the logs",
    });

    const child = await sessionOf(result.childThreadId!);

    expect(child?.runAsMemberId).toBe(owner.memberId);
    expect(child?.error).toBeNull();
    expect(child?.status).toBe("running");

    expect(await sessionOf(parent.threadId)).toMatchObject({
      status: "waiting",
    });

    const { settleDelegationFor } = await import("./delegations");
    await settleDelegationFor({
      threadId: result.childThreadId!,
      reply: "the logs say the disk filled up",
    });

    expect(await agentRepliesIn(parent.threadId)).toEqual([
      "the logs say the disk filled up",
    ]);
    expect(await sessionOf(parent.threadId)).toMatchObject({
      status: "running",
      error: null,
    });

    await fixture.cleanup();

    const { db, users } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");
    await db.delete(users).where(eq(users.id, owner.userId));
  });
});

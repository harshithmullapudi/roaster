import {
  db,
  members,
  projects,
  type SelectMember,
  threadSessions,
} from "@roster/db";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { channelAgentHandle, normalizeHandle } from "../lib/agent-identity";
import type { ChannelScope } from "./channels";

export interface Agent {
  id: string;
  handle: string;
  brief: string | null;
  projectId: string;
  channelSlug: string;
  channelName: string;
  main: boolean;
  ephemeral: boolean;
}

const agentColumns = {
  id: members.id,
  handle: members.agentName,
  brief: members.brief,
  projectId: members.projectId,
  channelSlug: projects.slug,
  channelName: projects.name,
  archivedAt: members.archivedAt,
  createdAt: members.createdAt,
  ephemeral: members.ephemeral,
};

type AgentRow = {
  id: string;
  handle: string | null;
  brief: string | null;
  projectId: string | null;
  channelSlug: string | null;
  channelName: string | null;
  createdAt: Date;
  ephemeral: boolean;
};

function toAgent(row: AgentRow, main = false): Agent {
  return {
    id: row.id,
    handle: row.handle ?? "agent",
    brief: row.brief,
    projectId: row.projectId ?? "",
    channelSlug: row.channelSlug ?? "",
    channelName: row.channelName ?? "",
    main,
    ephemeral: row.ephemeral,
  };
}

export async function listAgents(
  scope: ChannelScope,
  filter?: { projectId?: string },
): Promise<Agent[]> {
  const rows = await db
    .select(agentColumns)
    .from(members)
    .innerJoin(projects, eq(members.projectId, projects.id))
    .where(
      and(
        eq(members.organizationId, scope.organizationId),
        eq(members.type, "agent"),
        isNull(members.archivedAt),
        filter?.projectId ? eq(members.projectId, filter.projectId) : undefined,
      ),
    )
    .orderBy(asc(projects.slug), asc(members.createdAt));

  const oldest = new Map<string, string>();
  for (const row of rows) {
    const key = row.projectId ?? "";
    if (!oldest.has(key)) oldest.set(key, row.id);
  }

  return rows.map((row) => toAgent(row, oldest.get(row.projectId ?? "") === row.id));
}

export async function resolveAgent(args: {
  organizationId: string;
  handle: string;
}): Promise<Agent | null> {
  const wanted = normalizeHandle(args.handle);
  if (wanted.length === 0) return null;

  const [row] = await db
    .select(agentColumns)
    .from(members)
    .innerJoin(projects, eq(members.projectId, projects.id))
    .where(
      and(
        eq(members.organizationId, args.organizationId),
        eq(members.type, "agent"),
        isNull(members.archivedAt),
        eq(sql`lower(${members.agentName})`, wanted),
      ),
    )
    .limit(1);

  return row ? toAgent(row) : null;
}

export async function agentById(id: string): Promise<Agent | null> {
  const [row] = await db
    .select(agentColumns)
    .from(members)
    .innerJoin(projects, eq(members.projectId, projects.id))
    .where(and(eq(members.id, id), eq(members.type, "agent")))
    .limit(1);

  return row ? toAgent(row) : null;
}

export async function mainAgentFor(projectId: string): Promise<Agent | null> {
  const [row] = await db
    .select(agentColumns)
    .from(members)
    .innerJoin(projects, eq(members.projectId, projects.id))
    .where(
      and(
        eq(members.projectId, projectId),
        eq(members.type, "agent"),
        isNull(members.archivedAt),
      ),
    )
    .orderBy(asc(members.createdAt))
    .limit(1);

  return row ? toAgent(row, true) : null;
}

const HANDLE_SHAPE = /^[a-z0-9][a-z0-9-]*$/;

export function agentHandleFor(channelHandle: string, name: string): string {
  const role = normalizeHandle(name);
  return role.startsWith(`${channelHandle}-`) ? role : `${channelHandle}-${role}`;
}

export async function createAgent(args: {
  organizationId: string;
  projectId: string;
  name: string;
  brief?: string | null;
  ephemeral?: boolean;
}): Promise<Agent> {
  const main = await mainAgentFor(args.projectId);
  if (!main) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "That channel has no agent of its own to sit under.",
    });
  }

  const handle = agentHandleFor(main.handle, args.name);
  if (!HANDLE_SHAPE.test(handle)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "An agent name can only hold lowercase letters, numbers and dashes.",
    });
  }

  const existing = await resolveAgent({
    organizationId: args.organizationId,
    handle,
  });
  if (existing) {
    if (existing.projectId !== args.projectId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `"@${handle}" is taken in this workspace. Pick another name.`,
      });
    }
    return existing;
  }

  const [row] = await db
    .insert(members)
    .values({
      organizationId: args.organizationId,
      userId: null,
      role: "member",
      type: "agent",
      agentName: handle,
      projectId: args.projectId,
      brief: args.brief ?? null,
      ephemeral: Boolean(args.ephemeral),
    })
    .onConflictDoNothing({
      target: [members.organizationId, members.agentName],
    })
    .returning();

  if (!row) {
    const raced = await resolveAgent({
      organizationId: args.organizationId,
      handle,
    });
    if (raced) return raced;
    throw new TRPCError({
      code: "CONFLICT",
      message: `"@${handle}" is taken in this workspace. Pick another name.`,
    });
  }

  const agent = await agentById(row.id);
  if (!agent) throw new Error("That agent could not be read back.");

  return agent;
}

export async function archiveAgent(id: string): Promise<void> {
  const agent = await agentById(id);
  if (!agent) return;

  const main = await mainAgentFor(agent.projectId);
  if (main?.id === agent.id) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "That is the channel's own agent — archiving it would leave nobody to answer there.",
    });
  }

  await db
    .update(members)
    .set({
      archivedAt: new Date(),
      agentName: `${agent.handle}-archived-${id.replace(/-/g, "").slice(0, 6)}`,
    })
    .where(and(eq(members.id, id), eq(members.type, "agent")));
}

export async function setAgentBrief(args: {
  id: string;
  brief: string | null;
}): Promise<Agent | null> {
  await db
    .update(members)
    .set({ brief: args.brief })
    .where(and(eq(members.id, args.id), eq(members.type, "agent")));

  return agentById(args.id);
}

export async function updateAgent(args: {
  organizationId: string;
  id: string;
  name?: string;
  brief?: string | null;
}): Promise<Agent> {
  const agent = await agentById(args.id);
  if (!agent) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No such agent." });
  }

  const patch: { agentName?: string; brief?: string | null } = {};

  if (args.brief !== undefined) patch.brief = args.brief;

  if (args.name !== undefined) {
    const main = await mainAgentFor(agent.projectId);
    const handle =
      main && main.id !== agent.id
        ? agentHandleFor(main.handle, args.name)
        : channelAgentHandle(args.name);

    if (!HANDLE_SHAPE.test(handle)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "An agent name can only hold lowercase letters, numbers and dashes.",
      });
    }

    if (handle !== agent.handle) {
      const taken = await resolveAgent({
        organizationId: args.organizationId,
        handle,
      });
      if (taken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `"@${handle}" is taken in this workspace. Pick another name.`,
        });
      }
      patch.agentName = handle;
    }
  }

  if (Object.keys(patch).length > 0) {
    await db
      .update(members)
      .set(patch)
      .where(and(eq(members.id, args.id), eq(members.type, "agent")));
  }

  const updated = await agentById(args.id);
  if (!updated) throw new Error("That agent could not be read back.");

  return updated;
}

export async function archiveEphemeralAgentsFor(
  threadId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: members.id })
    .from(threadSessions)
    .innerJoin(members, eq(members.id, threadSessions.agentMemberId))
    .where(
      and(
        eq(threadSessions.threadId, threadId),
        eq(members.type, "agent"),
        eq(members.ephemeral, true),
        isNull(members.archivedAt),
      ),
    );

  const archived: string[] = [];
  for (const row of rows) {
    try {
      await archiveAgent(row.id);
      archived.push(row.id);
    } catch {
      continue;
    }
  }

  return archived;
}

export async function agentMemberRow(
  id: string,
): Promise<SelectMember | undefined> {
  return db.query.members.findFirst({ where: eq(members.id, id) });
}

export async function ensureChannelAgent(args: {
  organizationId: string;
  projectId: string;
  slug: string;
}): Promise<Agent> {
  const existing = await mainAgentFor(args.projectId);
  if (existing) return existing;

  const base = channelAgentHandle(args.slug);

  const taken = await resolveAgent({
    organizationId: args.organizationId,
    handle: base,
  });
  const handle = taken
    ? `${base}-${args.projectId.replace(/-/g, "").slice(0, 4)}`
    : base;

  const [row] = await db
    .insert(members)
    .values({
      organizationId: args.organizationId,
      userId: null,
      role: "member",
      type: "agent",
      agentName: handle,
      projectId: args.projectId,
    })
    .onConflictDoNothing({
      target: [members.organizationId, members.agentName],
    })
    .returning();

  const agent = row ? await agentById(row.id) : await mainAgentFor(args.projectId);
  if (!agent) throw new Error(`Could not give #${args.slug} an agent.`);

  return agent;
}

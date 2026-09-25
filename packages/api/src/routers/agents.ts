import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  agentById,
  archiveAgent,
  createAgent,
  listAgents,
  setAgentBrief,
} from "../services/agents";
import { type ChannelScope, requireOrgProject } from "../services/channels";
import { createTRPCRouter, memberProcedure } from "../trpc";

async function reachableChannel(scope: ChannelScope, projectId: string) {
  const project = await requireOrgProject({ ...scope, projectId });
  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "That channel is not one you can see.",
    });
  }
  return project;
}

async function ownAgent(scope: ChannelScope, agentId: string) {
  const agent = await agentById(agentId);
  if (!agent) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No such agent." });
  }

  await reachableChannel(scope, agent.projectId);
  return agent;
}

function scopeOf(ctx: {
  organizationId: string;
  member: { id: string; role: string };
}): ChannelScope {
  return {
    organizationId: ctx.organizationId,
    memberId: ctx.member.id,
    role: ctx.member.role,
  };
}

export const agentsRouter = createTRPCRouter({
  list: memberProcedure
    .input(z.object({ channelId: z.string().uuid().optional() }).optional())
    .query(({ ctx, input }) =>
      listAgents(scopeOf(ctx), { projectId: input?.channelId }),
    ),

  create: memberProcedure
    .input(
      z.object({
        channelId: z.string().uuid(),
        name: z.string().min(1).max(60),
        brief: z.string().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await reachableChannel(scopeOf(ctx), input.channelId);

      return createAgent({
        organizationId: ctx.organizationId,
        projectId: input.channelId,
        name: input.name,
        brief: input.brief ?? null,
      });
    }),

  setBrief: memberProcedure
    .input(
      z.object({
        agentId: z.string().uuid(),
        brief: z.string().max(4000).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ownAgent(scopeOf(ctx), input.agentId);
      return setAgentBrief({ id: input.agentId, brief: input.brief });
    }),

  archive: memberProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ownAgent(scopeOf(ctx), input.agentId);
      await archiveAgent(input.agentId);
      return { archived: true };
    }),
});

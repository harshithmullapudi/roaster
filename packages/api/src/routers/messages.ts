import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requireOrgProject } from "../services/channels";
import { listMessages, sendMessage } from "../services/messages";
import { createTRPCRouter, memberProcedure } from "../trpc";

export const messagesRouter = createTRPCRouter({
  list: memberProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        before: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const project = await requireOrgProject({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        projectId: input.projectId,
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      return listMessages({
        projectId: project.id,
        before: input.before,
        limit: input.limit,
      });
    }),

  send: memberProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        body: z.unknown(),
        text: z.string().min(1).max(20000),
        clientId: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await requireOrgProject({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        projectId: input.projectId,
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      return sendMessage({
        organizationId: ctx.organizationId,
        projectId: project.id,
        authorMemberId: ctx.member.id,
        body: input.body,
        text: input.text,
        clientId: input.clientId,
      });
    }),
});

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requireOrgProject } from "../services/channels";
import { reactionTarget, toggleReaction } from "../services/reactions";
import { createTRPCRouter, memberProcedure } from "../trpc";

export const reactionsRouter = createTRPCRouter({
  toggle: memberProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        messageId: z.string().uuid(),
        emoji: z.string().min(1).max(16),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await requireOrgProject({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        projectId: input.projectId,
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const target = await reactionTarget(input.messageId);
      if (!target || target.projectId !== project.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return toggleReaction({
        messageId: target.id,
        memberId: ctx.member.id,
        emoji: input.emoji,
      });
    }),
});

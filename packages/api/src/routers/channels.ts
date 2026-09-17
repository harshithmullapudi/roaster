import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  getChannelBySlug,
  listChannels,
  requireOrgProject,
  toggleChannelStar,
} from "../services/channels";
import { createTRPCRouter, memberProcedure } from "../trpc";

export const channelsRouter = createTRPCRouter({
  list: memberProcedure.query(({ ctx }) =>
    listChannels({
      organizationId: ctx.organizationId,
      memberId: ctx.member.id,
    }),
  ),

  get: memberProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const channel = await getChannelBySlug({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        slug: input.slug,
      });
      if (!channel) throw new TRPCError({ code: "NOT_FOUND" });
      return channel;
    }),

  toggleStar: memberProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireOrgProject({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        projectId: input.projectId,
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      return toggleChannelStar({
        memberId: ctx.member.id,
        projectId: project.id,
      });
    }),
});

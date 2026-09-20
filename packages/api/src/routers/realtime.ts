import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  channelName,
  connectionToken,
  subscriptionToken,
  userChannelName,
  websocketUrl,
} from "../services/centrifugo";
import { requireOrgProject } from "../services/channels";
import { threadChannelName, threadProjectId } from "../services/sessions";
import { createTRPCRouter, memberProcedure } from "../trpc";

export const realtimeRouter = createTRPCRouter({
  connectionToken: memberProcedure.query(({ ctx }) => {
    const token = connectionToken(ctx.session.user.id);
    const url = websocketUrl();
    if (!token || !url) return { enabled: false as const };
    return { enabled: true as const, token, url };
  }),

  subscriptionToken: memberProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const project = await requireOrgProject({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        projectId: input.projectId,
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const channel = channelName(project.id);
      const token = subscriptionToken(ctx.session.user.id, channel);
      if (!token) return { enabled: false as const, channel };
      return { enabled: true as const, channel, token };
    }),

  userSubscriptionToken: memberProcedure.query(({ ctx }) => {
    const channel = userChannelName(ctx.session.user.id);
    const token = subscriptionToken(ctx.session.user.id, channel);
    if (!token) return { enabled: false as const, channel };
    return { enabled: true as const, channel, token };
  }),

  threadSubscriptionToken: memberProcedure
    .input(z.object({ threadId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const projectId = await threadProjectId(input.threadId);
      if (!projectId) throw new TRPCError({ code: "NOT_FOUND" });

      const project = await requireOrgProject({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        projectId,
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const channel = threadChannelName(input.threadId);
      const token = subscriptionToken(ctx.session.user.id, channel);
      if (!token) return { enabled: false as const, channel };
      return { enabled: true as const, channel, token };
    }),
});

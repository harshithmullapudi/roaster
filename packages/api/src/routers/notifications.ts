import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  markAllNotificationsRead,
  markThreadRead,
  setThreadSubscription,
  unfollowThread,
  unreadNotificationCount,
  visibleThread,
} from "../services/notifications";
import { createTRPCRouter, memberProcedure } from "../trpc";

import type { ChannelScope } from "../services/channels";

const threadInput = z.object({ threadId: z.string().uuid() });

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

async function reachableThread(
  scope: ChannelScope,
  threadId: string,
): Promise<void> {
  const thread = await visibleThread({ ...scope, threadId });
  if (!thread) throw new TRPCError({ code: "NOT_FOUND" });
}

export const notificationsRouter = createTRPCRouter({
  unreadCount: memberProcedure.query(({ ctx }) =>
    unreadNotificationCount(scopeOf(ctx)),
  ),

  markAllRead: memberProcedure.mutation(async ({ ctx }) => ({
    read: await markAllNotificationsRead(scopeOf(ctx)),
  })),

  markThreadRead: memberProcedure
    .input(threadInput)
    .mutation(async ({ ctx, input }) => {
      const scope = scopeOf(ctx);
      await reachableThread(scope, input.threadId);
      return markThreadRead({ ...scope, threadId: input.threadId });
    }),

  setSubscription: memberProcedure
    .input(threadInput.extend({ muted: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const scope = scopeOf(ctx);
      await reachableThread(scope, input.threadId);
      return setThreadSubscription({
        ...scope,
        threadId: input.threadId,
        muted: input.muted,
      });
    }),

  unfollow: memberProcedure
    .input(threadInput)
    .mutation(async ({ ctx, input }) => {
      const scope = scopeOf(ctx);
      await reachableThread(scope, input.threadId);
      return unfollowThread({ ...scope, threadId: input.threadId });
    }),
});

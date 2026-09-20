import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { CHANNEL_VISIBILITIES } from "../lib/channel-visibility";
import {
  dismissChannelPause,
  getChannelBySlug,
  listChannels,
  listMentionableChannels,
  listMentionableMembers,
  requireOrgProject,
  setChannelWatch,
  toggleChannelStar,
  updateChannel,
} from "../services/channels";
import { pausedMessageCount, startPausedSession } from "../services/messages";
import {
  capabilityProcedure,
  createTRPCRouter,
  memberProcedure,
} from "../trpc";

export const channelsRouter = createTRPCRouter({
  list: memberProcedure.query(({ ctx }) =>
    listChannels({
      organizationId: ctx.organizationId,
      memberId: ctx.member.id,
      role: ctx.member.role,
    }),
  ),

  /**
   * Everyone the caller may address, for the composer's `@` autocomplete:
   * agents drawn from the same visibility rules as the sidebar — so mentioning
   * can never reach a channel the member could not already open — and the
   * organization's people.
   *
   * One list, not two. `@` is a single namespace and the composer ranks it as
   * one dropdown; `kind` is what tells a person from an agent downstream.
   */
  mentionable: memberProcedure.query(async ({ ctx }) => {
    const scope = {
      organizationId: ctx.organizationId,
      memberId: ctx.member.id,
      role: ctx.member.role,
    };

    const [channels, people] = await Promise.all([
      listMentionableChannels(scope),
      listMentionableMembers(scope),
    ]);

    return [
      ...channels.map((channel) => ({
        id: channel.id,
        kind: "agent" as const,
        slug: channel.slug,
        name: channel.name,
        visibility: channel.visibility,
        handle: channel.agentHandle,
        display: channel.agentDisplay,
      })),
      ...people.map((person) => ({
        id: person.id,
        kind: "member" as const,
        // A person has no channel to be private to, so the fields a channel
        // fills with its slug and visibility carry the handle and "public".
        slug: person.handle,
        name: person.name,
        visibility: "public",
        handle: person.handle,
        display: person.name,
      })),
    ];
  }),

  get: memberProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const channel = await getChannelBySlug({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
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
        role: ctx.member.role,
        projectId: input.projectId,
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      return toggleChannelStar({
        memberId: ctx.member.id,
        projectId: project.id,
      });
    }),

  setWatch: memberProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        enabled: z.boolean(),
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

      const watch = await setChannelWatch({
        projectId: project.id,
        enabled: input.enabled,
      });
      if (!watch) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        ...watch,
        pendingCount: await pausedMessageCount(project.id),
      };
    }),

  dismissPause: memberProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireOrgProject({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        projectId: input.projectId,
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const watch = await dismissChannelPause(project.id);
      if (!watch) throw new TRPCError({ code: "NOT_FOUND" });

      return { ...watch, pendingCount: 0 };
    }),

  startFromPause: memberProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireOrgProject({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        projectId: input.projectId,
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const started = await startPausedSession(project.id);
      return { started: started !== null };
    }),

  update: capabilityProcedure("channel:update")
    .input(
      z.object({
        projectId: z.string().uuid(),
        visibility: z.enum(CHANNEL_VISIBILITIES).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, ...patch } = input;

      const channel = await updateChannel({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        projectId,
        patch,
      });
      if (!channel) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        id: channel.id,
        slug: channel.slug,
        visibility: channel.visibility,
      };
    }),
});

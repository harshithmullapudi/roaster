import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { TASK_STATUSES } from "../lib/task-status";
import {
  listMentionableChannels,
  requireOrgProject,
} from "../services/channels";
import { delegate } from "../services/delegations";
import { listMessages } from "../services/messages";
import { assignTask } from "../services/task-assignment";
import { createTask, setTaskStatus } from "../services/tasks";
import { cliProcedure, createTRPCRouter } from "../trpc";

export const cliRouter = createTRPCRouter({
  whoami: cliProcedure.query(async ({ ctx }) => ({
    memberId: ctx.member.id,
    organizationId: ctx.organizationId,
    role: ctx.member.role,
    agentName: ctx.member.agentName,
  })),

  channels: cliProcedure.query(async ({ ctx }) => {
    const channels = await listMentionableChannels({
      organizationId: ctx.organizationId,
      memberId: ctx.member.id,
      role: ctx.member.role,
    });

    return channels.map((channel) => ({
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
      visibility: channel.visibility,
      handle: channel.agentHandle,
    }));
  }),

  readMessages: cliProcedure
    .input(
      z.object({
        channelId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const project = await requireOrgProject({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        projectId: input.channelId,
      });

      if (!project) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "This key cannot read that channel. It is private to someone else, or does not exist.",
        });
      }

      const messages = await listMessages({
        projectId: project.id,
        limit: input.limit,
      });

      return {
        channel: { id: project.id, slug: project.slug, name: project.name },
        messages: messages.map((message) => ({
          id: message.id,
          author:
            message.agentDisplay ||
            message.authorName ||
            message.authorEmail ||
            "unknown",
          kind: message.kind,
          text: message.text,
          createdAt: message.createdAt.toISOString(),
        })),
      };
    }),

  ask: cliProcedure
    .input(
      z.object({
        threadId: z.string().uuid(),
        handle: z.string().min(1),
        task: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      delegate({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        parentThreadId: input.threadId,
        handle: input.handle,
        task: input.task,
      }),
    ),

  createTask: cliProcedure
    .input(
      z.object({
        channelId: z.string().uuid().optional(),
        title: z.string().min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await createTask({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        title: input.title,
        status: "todo",
      });

      if (!task) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not file that task.",
        });
      }

      if (!input.channelId) return task;

      return assignTask({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        taskId: task.id,
        projectId: input.channelId,
      });
    }),

  setTaskStatus: cliProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        status: z.enum(TASK_STATUSES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await setTaskStatus({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        taskId: input.taskId,
        status: input.status,
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This key cannot see a task with that id.",
        });
      }

      return task;
    }),
});

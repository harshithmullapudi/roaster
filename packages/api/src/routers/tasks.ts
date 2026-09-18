import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { TASK_STATUSES } from "../lib/task-status";
import { assignTask } from "../services/task-assignment";
import { createTask, listTasks, setTaskStatus } from "../services/tasks";
import { createTRPCRouter, memberProcedure } from "../trpc";

const statusSchema = z.enum(TASK_STATUSES);

export const tasksRouter = createTRPCRouter({
  list: memberProcedure
    .input(z.object({ projectId: z.string().uuid().optional() }).optional())
    .query(({ ctx, input }) =>
      listTasks({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        projectId: input?.projectId,
      }),
    ),

  /**
   * Filing work and handing it out are the same call: without a channel the
   * task waits in the backlog, with one its channel's agent starts on it.
   */
  create: memberProcedure
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(500),
        status: statusSchema.default("todo"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await createTask({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        title: input.title,
        status: input.status,
      });
      if (!task) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (!input.projectId) return task;

      return assignTask({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        taskId: task.id,
        projectId: input.projectId,
      });
    }),

  assign: memberProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        projectId: z.string().uuid(),
      }),
    )
    .mutation(({ ctx, input }) =>
      assignTask({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        taskId: input.taskId,
        projectId: input.projectId,
      }),
    ),

  setStatus: memberProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        status: statusSchema,
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
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),
});

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { TASK_STATUSES } from "../lib/task-status";
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

  create: memberProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().trim().min(1).max(500),
        description: z.unknown().optional(),
        descriptionText: z.string().max(20000).default(""),
        status: statusSchema.default("todo"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await createTask({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        projectId: input.projectId,
        title: input.title,
        description: input.description ?? null,
        descriptionText: input.descriptionText,
        status: input.status,
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),

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

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { describeRecurrence, RecurrenceError } from "../lib/recurrence";
import {
  createSchedule,
  deleteSchedule,
  firstOccurrence,
  listRuns,
  listSchedules,
  updateSchedule,
} from "../services/scheduled-tasks";
import { createTRPCRouter, memberProcedure } from "../trpc";

const NOT_FOUND = new TRPCError({
  code: "NOT_FOUND",
  message: "This account cannot see a schedule with that id.",
});

function asBadRequest(cause: unknown): never {
  if (cause instanceof RecurrenceError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: cause.message });
  }
  throw cause;
}

const ruleSchema = z.string().trim().min(1).max(500);
const timezoneSchema = z.string().trim().min(1).max(100);

export const scheduledTasksRouter = createTRPCRouter({
  describe: memberProcedure
    .input(z.object({ rrule: ruleSchema, timezone: timezoneSchema }))
    .query(({ input }) => {
      try {
        return {
          text: describeRecurrence(input.rrule),
          nextRunAt: firstOccurrence({
            rrule: input.rrule,
            timezone: input.timezone,
          }),
        };
      } catch (cause) {
        asBadRequest(cause);
      }
    }),

  list: memberProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      listSchedules({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        projectId: input.projectId,
      }),
    ),

  runs: memberProcedure
    .input(
      z.object({
        scheduleId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    )
    .query(({ ctx, input }) =>
      listRuns({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        scheduleId: input.scheduleId,
        limit: input.limit,
      }),
    ),

  create: memberProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().trim().min(1).max(500),
        rrule: ruleSchema,
        timezone: timezoneSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let schedule;
      try {
        schedule = await createSchedule({
          organizationId: ctx.organizationId,
          memberId: ctx.member.id,
          role: ctx.member.role,
          ...input,
        });
      } catch (cause) {
        asBadRequest(cause);
      }

      if (!schedule) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This account cannot add a schedule to that channel.",
        });
      }

      return schedule;
    }),

  update: memberProcedure
    .input(
      z.object({
        scheduleId: z.string().uuid(),
        title: z.string().trim().min(1).max(500).optional(),
        rrule: ruleSchema.optional(),
        timezone: timezoneSchema.optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let schedule;
      try {
        schedule = await updateSchedule({
          organizationId: ctx.organizationId,
          memberId: ctx.member.id,
          role: ctx.member.role,
          ...input,
        });
      } catch (cause) {
        asBadRequest(cause);
      }

      if (!schedule) throw NOT_FOUND;
      return schedule;
    }),

  remove: memberProcedure
    .input(z.object({ scheduleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const removed = await deleteSchedule({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        role: ctx.member.role,
        scheduleId: input.scheduleId,
      });

      if (!removed) throw NOT_FOUND;
      return { removed: input.scheduleId };
    }),
});

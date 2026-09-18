import { SupersetError } from "@roster/superset";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  chooseSupersetOrganization,
  connectSuperset,
  hostsFor,
  projectsForAllHosts,
  supersetConnectionFor,
  supersetOrganizationsFor,
} from "../services/superset-connection";
import { createTRPCRouter, memberProcedure } from "../trpc";

const apiKeySchema = z
  .string()
  .trim()
  .min(1, "Paste your Superset API key.")
  .startsWith("sk_", "That doesn't look like a Superset API key.");

function toTRPCError(cause: unknown): never {
  if (cause instanceof SupersetError) {
    throw new TRPCError({
      code:
        cause.status === 401 || cause.status === 403
          ? "FORBIDDEN"
          : "BAD_GATEWAY",
      message: cause.message,
    });
  }
  throw cause;
}

export const supersetRouter = createTRPCRouter({
  connect: memberProcedure
    .input(z.object({ apiKey: apiKeySchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await connectSuperset({
          memberId: ctx.member.id,
          apiKey: input.apiKey,
        });
      } catch (cause) {
        toTRPCError(cause);
      }
    }),

  organizations: memberProcedure.query(async ({ ctx }) => {
    try {
      return await supersetOrganizationsFor(ctx.member);
    } catch (cause) {
      toTRPCError(cause);
    }
  }),

  chooseOrganization: memberProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await chooseSupersetOrganization({
          member: ctx.member,
          organizationId: input.organizationId,
        });
        return { organizationId: input.organizationId };
      } catch (cause) {
        toTRPCError(cause);
      }
    }),

  hosts: memberProcedure.query(async ({ ctx }) => {
    try {
      return await hostsFor(ctx.member);
    } catch (cause) {
      toTRPCError(cause);
    }
  }),

  projects: memberProcedure.query(async ({ ctx }) => {
    try {
      return await projectsForAllHosts({
        member: ctx.member,
        organizationId: ctx.organizationId,
      });
    } catch (cause) {
      toTRPCError(cause);
    }
  }),

  connection: memberProcedure.query(async ({ ctx }) => {
    try {
      return await supersetConnectionFor(ctx.member);
    } catch (cause) {
      toTRPCError(cause);
    }
  }),
});

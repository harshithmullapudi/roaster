import { db, members } from "@roster/db";
import { initTRPC, TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import superjson from "superjson";

import { can, type Capability } from "./lib/access";
import { keyHolderMember, verifyApiKey } from "./services/api-keys";

import type { Context } from "./context";

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const memberProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const userId = ctx.session.user.id;
  const activeOrganizationId = ctx.session.session.activeOrganizationId;

  const member = activeOrganizationId
    ? await db.query.members.findFirst({
        where: and(
          eq(members.organizationId, activeOrganizationId),
          eq(members.userId, userId),
        ),
      })
    : await db.query.members.findFirst({
        where: eq(members.userId, userId),
        orderBy: desc(members.createdAt),
      });

  if (!member) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active team.",
    });
  }

  return next({
    ctx: { ...ctx, organizationId: member.organizationId, member },
  });
});

export const cliProcedure = t.procedure.use(async ({ ctx, next }) => {
  const header = ctx.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";

  if (token.length === 0) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "No API key. Run `roster login` on this machine.",
    });
  }

  const holder = await verifyApiKey(token);
  if (!holder) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "That API key is not valid. Run `roster login` again.",
    });
  }

  const member = await keyHolderMember(holder);
  if (!member) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "That key's team membership is gone.",
    });
  }

  return next({
    ctx: { ...ctx, organizationId: holder.organizationId, member },
  });
});

export function capabilityProcedure(capability: Capability) {
  return memberProcedure.use(({ ctx, next }) => {
    if (!can(ctx.member.role, capability)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have permission to do that.",
      });
    }
    return next({ ctx });
  });
}

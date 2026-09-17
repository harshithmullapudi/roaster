import { db, members } from "@roster/db";
import { initTRPC, TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import superjson from "superjson";

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

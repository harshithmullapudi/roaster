import { listUserOrganizations } from "./org";
import { createTRPCRouter, protectedProcedure } from "./trpc";

/**
 * One procedure, on purpose.
 *
 * better-auth's organization plugin already serves create / inviteMember /
 * acceptInvitation / listInvitations / cancelInvitation / removeMember /
 * updateMemberRole over `/api/auth/*`, and the UI calls those directly.
 * Wrapping them in tRPC would add procedures that forward arguments and return
 * the result unchanged.
 *
 * What this router does provide is the seam: a context, superjson, and an
 * `AppRouter` type for `packages/cli` to import. Real procedures arrive with
 * the first feature better-auth does not already cover — which is channels.
 */
export const appRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => ({
    user: ctx.session.user,
    organizations: await listUserOrganizations(ctx.session.user.id),
  })),
});

export type AppRouter = typeof appRouter;

import { onboardingRouter } from "./routers/onboarding";
import { supersetRouter } from "./routers/superset";
import { listUserOrganizations } from "./services/org";
import { createTRPCRouter, protectedProcedure } from "./trpc";

export const appRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => ({
    user: ctx.session.user,
    organizations: await listUserOrganizations(ctx.session.user.id),
  })),
  superset: supersetRouter,
  onboarding: onboardingRouter,
});

export type AppRouter = typeof appRouter;

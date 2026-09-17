import { channelsRouter } from "./routers/channels";
import { messagesRouter } from "./routers/messages";
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
  channels: channelsRouter,
  messages: messagesRouter,
});

export type AppRouter = typeof appRouter;

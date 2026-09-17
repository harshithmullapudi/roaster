import { apiKeysRouter } from "./routers/api-keys";
import { channelsRouter } from "./routers/channels";
import { cliRouter } from "./routers/cli";
import { messagesRouter } from "./routers/messages";
import { onboardingRouter } from "./routers/onboarding";
import { realtimeRouter } from "./routers/realtime";
import { supersetRouter } from "./routers/superset";
import { tasksRouter } from "./routers/tasks";
import { threadsRouter } from "./routers/threads";
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
  cli: cliRouter,
  apiKeys: apiKeysRouter,
  messages: messagesRouter,
  tasks: tasksRouter,
  threads: threadsRouter,
  realtime: realtimeRouter,
});

export type AppRouter = typeof appRouter;

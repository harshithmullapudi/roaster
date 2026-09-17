import type { AppRouter } from "@roster/api";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
    }),
  ],
});

export function errorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof TRPCClientError) return cause.message;
  if (cause instanceof Error) return cause.message;
  return fallback;
}

import { appRouter, createContext } from "@roster/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ headers: req.headers }),
    onError({ error, path }) {
      console.error(`tRPC error on ${path ?? "<no path>"}:`, error);
    },
  });
}

export { handler as GET, handler as POST };

import { auth } from "@roster/auth";

export interface CreateContextArgs {
  headers: Headers;
}

export async function createContext({ headers }: CreateContextArgs) {
  const session = await auth.api.getSession({ headers });

  return {
    headers,
    session: session ?? null,
    user: session?.user ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

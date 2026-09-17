import { auth } from "@roster/auth";

export interface CreateContextArgs {
  headers: Headers;
}

/**
 * The session is resolved here and nowhere else. Procedures that need a team
 * take its slug as input and call `resolveOrgAccess` — the session's
 * `activeOrganizationId` is a landing preference, not an authorization fact.
 */
export async function createContext({ headers }: CreateContextArgs) {
  const session = await auth.api.getSession({ headers });

  return {
    headers,
    session: session ?? null,
    user: session?.user ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

import "server-only";

import { listUserOrganizations, resolveOrgAccess } from "@roster/api";
import { auth } from "@roster/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

/**
 * The authorization check for every team-scoped page.
 *
 * `notFound()` rather than a "you don't have access" page on purpose: a
 * distinct message would tell anyone who guesses a slug whether that team
 * exists. Same reason `resolveOrgAccess` collapses "no such team" and "not
 * your team" into one null.
 */
export async function requireOrg(slug: string) {
  const session = await requireSession();
  const access = await resolveOrgAccess({ userId: session.user.id, slug });
  if (!access) notFound();
  return { session, ...access };
}

export async function myOrganizations(userId: string) {
  return listUserOrganizations(userId);
}

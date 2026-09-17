import { redirect } from "next/navigation";

import { getSession, myOrganizations } from "~/lib/session";

/**
 * The only job of `/` is to decide where you belong: signed out, no team, or
 * a team. Nothing renders here.
 */
export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const organizations = await myOrganizations(session.user.id);
  if (organizations.length === 0) redirect("/onboarding");

  const active =
    organizations.find(
      (org) => org.id === session.session.activeOrganizationId,
    ) ?? organizations[0];

  redirect(`/${active!.slug}`);
}

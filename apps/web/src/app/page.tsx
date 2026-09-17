import { loadOnboardingState } from "@roster/api";
import { redirect } from "next/navigation";

import { getSession, myOrganizations } from "~/lib/session";

export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const organizations = await myOrganizations(session.user.id);
  if (organizations.length === 0) redirect("/onboarding");

  const active =
    organizations.find(
      (org) => org.id === session.session.activeOrganizationId,
    ) ?? organizations[0]!;

  const state = await loadOnboardingState({
    userId: session.user.id,
    organizationId: active.id,
  });

  if (!state.supersetOrgChosen || !state.hasAgentName) redirect("/onboarding");

  redirect(`/${active.slug}`);
}

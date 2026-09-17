import { redirect } from "next/navigation";

import { AuthShell } from "~/components/auth-shell";
import { myOrganizations, requireSession } from "~/lib/session";

import { CreateTeamForm } from "./create-team-form";

export default async function OnboardingPage() {
  const session = await requireSession();

  // Reached by someone who already has a team — usually a stale tab, or an
  // invitation accepted in another window.
  const organizations = await myOrganizations(session.user.id);
  if (organizations.length > 0) redirect(`/${organizations[0]!.slug}`);

  return (
    <AuthShell
      title="Create your team"
      subtitle="Everyone you work with lives in one team. You can make more later."
      footer={`Signed in as ${session.user.email}.`}
    >
      <CreateTeamForm />
    </AuthShell>
  );
}

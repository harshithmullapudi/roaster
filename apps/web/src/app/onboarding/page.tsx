import {
  listInvitationsForUser,
  loadOnboardingState,
  resolveStep,
} from "@roster/api";
import { redirect } from "next/navigation";

import { AgentNameForm } from "~/components/onboarding/agent-name-form";
import { ChooseOrganizationForm } from "~/components/onboarding/choose-organization-form";
import { ConnectSupersetForm } from "~/components/onboarding/connect-superset-form";
import { CreateTeamForm } from "~/components/onboarding/create-team-form";
import { JoinTeamForm } from "~/components/onboarding/join-team-form";
import {
  OnboardingShell,
  type OnboardingStepKey,
} from "~/components/onboarding/onboarding-shell";
import { ProjectPicker } from "~/components/onboarding/project-picker";
import { myOrganizations, requireSession } from "~/lib/session";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await requireSession();
  const { step: requested } = await searchParams;

  const organizations = await myOrganizations(session.user.id);
  const activeOrg =
    organizations.find(
      (org) => org.id === session.session.activeOrganizationId,
    ) ?? organizations[0];

  const state = await loadOnboardingState({
    userId: session.user.id,
    email: session.user.email,
    organizationId: activeOrg?.id ?? null,
  });

  const step = resolveStep(state, requested);
  if (step === "done") redirect(`/${activeOrg!.slug}`);

  const visibleSteps: OnboardingStepKey[] = [];
  if (step === "invitations") visibleSteps.push("invitations");
  else if (!state.hasMembership) visibleSteps.push("workspace");
  visibleSteps.push("connect");
  if (step === "organization") visibleSteps.push("organization");
  visibleSteps.push("projects", "agent");

  if (step === "invitations") {
    const invitations = await listInvitationsForUser({
      userId: session.user.id,
      email: session.user.email,
    });

    return (
      <OnboardingShell
        step="invitations"
        visibleSteps={visibleSteps}
        title={
          invitations.length === 1
            ? `Join ${invitations[0]!.organization.name}`
            : "You've been invited"
        }
      >
        <JoinTeamForm
          invitations={invitations}
          initialUserName={session.user.name ?? ""}
        />
      </OnboardingShell>
    );
  }

  if (step === "workspace") {
    return (
      <OnboardingShell
        step="workspace"
        visibleSteps={visibleSteps}
        title="Create your workspace"
      >
        <CreateTeamForm initialUserName={session.user.name ?? ""} />
      </OnboardingShell>
    );
  }

  if (step === "connect") {
    return (
      <OnboardingShell
        step="connect"
        visibleSteps={visibleSteps}
        title="Connect Superset"
      >
        <ConnectSupersetForm />
      </OnboardingShell>
    );
  }

  if (step === "organization") {
    return (
      <OnboardingShell
        step="organization"
        visibleSteps={visibleSteps}
        title="Choose your Superset org"
      >
        <ChooseOrganizationForm />
      </OnboardingShell>
    );
  }

  if (step === "projects") {
    return (
      <OnboardingShell
        step="projects"
        visibleSteps={visibleSteps}
        title="Pick your projects"
        wide
      >
        <ProjectPicker />
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      step="agent"
      visibleSteps={visibleSteps}
      title="Name your agent"
    >
      <AgentNameForm exampleChannel={activeOrg?.slug ?? "roster"} />
    </OnboardingShell>
  );
}

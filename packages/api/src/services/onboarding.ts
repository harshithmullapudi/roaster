import { db, members, projects } from "@roster/db";
import { and, eq } from "drizzle-orm";

export const ONBOARDING_STEPS = [
  "workspace",
  "connect",
  "organization",
  "projects",
  "agent",
  "done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingState {
  hasMembership: boolean;
  supersetKeyStored: boolean;
  supersetOrgChosen: boolean;
  organizationHasProjects: boolean;
  hasAgentName: boolean;
}

export function furthestStep(state: OnboardingState): OnboardingStep {
  if (!state.hasMembership) return "workspace";
  if (!state.supersetKeyStored) return "connect";
  if (!state.supersetOrgChosen) return "organization";
  if (!state.hasAgentName) {
    return state.organizationHasProjects ? "agent" : "projects";
  }
  return "done";
}

export function resolveStep(
  state: OnboardingState,
  requested?: string | null,
): OnboardingStep {
  const furthest = furthestStep(state);
  if (requested !== "agent") return furthest;
  return furthest === "projects" ? "agent" : furthest;
}

export async function loadOnboardingState(args: {
  userId: string;
  organizationId: string | null;
}): Promise<OnboardingState> {
  const empty: OnboardingState = {
    hasMembership: false,
    supersetKeyStored: false,
    supersetOrgChosen: false,
    organizationHasProjects: false,
    hasAgentName: false,
  };

  if (!args.organizationId) return empty;

  const member = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, args.organizationId),
      eq(members.userId, args.userId),
    ),
  });

  if (!member) return empty;

  const project = await db.query.projects.findFirst({
    where: eq(projects.organizationId, args.organizationId),
    columns: { id: true },
  });

  return {
    hasMembership: true,
    supersetKeyStored: Boolean(member.supersetKeyEncrypted),
    supersetOrgChosen: Boolean(member.supersetOrgId),
    organizationHasProjects: Boolean(project),
    hasAgentName: Boolean(member.agentName),
  };
}

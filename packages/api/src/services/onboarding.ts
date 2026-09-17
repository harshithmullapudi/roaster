import { db, members, projects } from "@roster/db";
import { and, eq } from "drizzle-orm";

export const ONBOARDING_STEPS = [
  "workspace",
  "connect",
  "projects",
  "agent",
  "done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingState {
  hasMembership: boolean;
  supersetConnected: boolean;
  organizationHasProjects: boolean;
  hasAgentName: boolean;
}

export function furthestStep(state: OnboardingState): OnboardingStep {
  if (!state.hasMembership) return "workspace";
  if (!state.supersetConnected) return "connect";
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
  if (!args.organizationId) {
    return {
      hasMembership: false,
      supersetConnected: false,
      organizationHasProjects: false,
      hasAgentName: false,
    };
  }

  const member = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, args.organizationId),
      eq(members.userId, args.userId),
    ),
  });

  if (!member) {
    return {
      hasMembership: false,
      supersetConnected: false,
      organizationHasProjects: false,
      hasAgentName: false,
    };
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.organizationId, args.organizationId),
    columns: { id: true },
  });

  return {
    hasMembership: true,
    supersetConnected: Boolean(member.supersetConnectedAt),
    organizationHasProjects: Boolean(project),
    hasAgentName: Boolean(member.agentName),
  };
}

import { db, members, projects } from "@roster/db";
import { and, eq } from "drizzle-orm";

import { listInvitationsForUser } from "./org";

export const ONBOARDING_STEPS = [
  "invitations",
  "workspace",
  "connect",
  "organization",
  "projects",
  "agent",
  "done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingState {
  hasInvitations: boolean;
  hasMembership: boolean;
  supersetKeyStored: boolean;
  supersetOrgChosen: boolean;
  organizationHasProjects: boolean;
  hasAgentName: boolean;
}

export function furthestStep(state: OnboardingState): OnboardingStep {
  // Someone invited by a friend usually arrives through the emailed link and
  // is a member before they ever reach onboarding. When they sign up at the
  // front door instead, this is the only thing that tells them the team is
  // waiting — without it they'd be walked into a workspace of their own.
  if (!state.hasMembership) {
    return state.hasInvitations ? "invitations" : "workspace";
  }
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

  // Two forward moves are allowed, and only these two: turning down every
  // invitation to start a workspace of your own, and naming the agent without
  // picking projects first.
  if (requested === "workspace" && furthest === "invitations") {
    return "workspace";
  }
  if (requested !== "agent") return furthest;
  return furthest === "projects" ? "agent" : furthest;
}

export async function loadOnboardingState(args: {
  userId: string;
  email: string;
  organizationId: string | null;
}): Promise<OnboardingState> {
  const invitations = await listInvitationsForUser({
    userId: args.userId,
    email: args.email,
  });
  const hasInvitations = invitations.length > 0;

  const empty: OnboardingState = {
    hasInvitations,
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
    hasInvitations,
    hasMembership: true,
    supersetKeyStored: Boolean(member.supersetKeyEncrypted),
    supersetOrgChosen: Boolean(member.supersetOrgId),
    organizationHasProjects: Boolean(project),
    hasAgentName: Boolean(member.agentName),
  };
}

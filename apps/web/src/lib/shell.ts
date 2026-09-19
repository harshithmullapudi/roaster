import "server-only";

import {
  can,
  listChannels,
  listLiveThreads,
  type Capability,
  type ChannelGroups,
  type LiveThread,
} from "@roster/api";

import type { OrgSummary, UserSummary } from "~/types";

import { myOrganizations, requireOrg } from "./session";

export interface Shell {
  organization: OrgSummary;
  organizations: OrgSummary[];
  user: UserSummary;
  member: { id: string; role: string };
  channels: ChannelGroups;
  liveThreads: LiveThread[];
  can: (capability: Capability) => boolean;
}

export async function loadShell(slug: string) {
  const { session, organization, member } = await requireOrg(slug);

  const scope = {
    organizationId: organization.id,
    memberId: member.id,
    role: member.role,
  };

  const [organizations, channels, liveThreads] = await Promise.all([
    myOrganizations(session.user.id),
    listChannels(scope),
    listLiveThreads(scope),
  ]);

  const shell: Shell = {
    organization,
    organizations,
    user: session.user,
    member,
    channels,
    liveThreads,
    can: (capability) => can(member.role, capability),
  };

  return { session, organization, member, shell };
}

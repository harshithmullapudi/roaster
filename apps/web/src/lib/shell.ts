import "server-only";

import {
  can,
  listChannels,
  type Capability,
  type ChannelGroups,
} from "@roster/api";

import type { OrgSummary, UserSummary } from "~/types";

import { myOrganizations, requireOrg } from "./session";

export interface Shell {
  organization: OrgSummary;
  organizations: OrgSummary[];
  user: UserSummary;
  member: { id: string; role: string };
  channels: ChannelGroups;
  can: (capability: Capability) => boolean;
}

export async function loadShell(slug: string) {
  const { session, organization, member } = await requireOrg(slug);

  const scope = {
    organizationId: organization.id,
    memberId: member.id,
    role: member.role,
  };

  const [organizations, channels] = await Promise.all([
    myOrganizations(session.user.id),
    listChannels(scope),
  ]);

  const shell: Shell = {
    organization,
    organizations,
    user: session.user,
    member,
    channels,
    can: (capability) => can(member.role, capability),
  };

  return { session, organization, member, shell };
}

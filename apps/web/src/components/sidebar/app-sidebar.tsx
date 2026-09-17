import type { ChannelGroups } from "@roster/api";
import { CircleCheck, Users } from "lucide-react";

import type { OrgSummary, SidebarSection, UserSummary } from "~/types";

import { ChannelSections } from "./channel-sections";
import { SidebarLink } from "./sidebar-link";
import { WorkspaceMenu } from "./workspace-menu";

export interface AppSidebarProps {
  activeOrg: OrgSummary;
  organizations: OrgSummary[];
  user: UserSummary;
  section: SidebarSection;
  channels: ChannelGroups;
  activeChannelSlug?: string;
}

export function AppSidebar({
  activeOrg,
  organizations,
  user,
  section,
  channels,
  activeChannelSlug,
}: AppSidebarProps) {
  return (
    <aside className="bg-background flex w-56 shrink-0 flex-col gap-3 p-2">
      <WorkspaceMenu
        activeOrg={activeOrg}
        organizations={organizations}
        user={user}
      />

      <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
        <div className="flex w-full min-w-0 flex-col gap-0.5">
          <SidebarLink
            href={`/${activeOrg.slug}/tasks`}
            active={section === "tasks"}
            icon={<CircleCheck size={16} />}
            label="My tasks"
          />
          <SidebarLink
            href={`/${activeOrg.slug}/settings/members`}
            active={section === "members"}
            icon={<Users size={16} />}
            label="Members"
          />
        </div>

        <ChannelSections
          groups={channels}
          orgSlug={activeOrg.slug}
          activeChannelSlug={activeChannelSlug}
        />
      </nav>
    </aside>
  );
}

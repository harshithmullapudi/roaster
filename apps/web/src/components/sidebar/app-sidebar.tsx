import { Hash, Users } from "lucide-react";

import type { OrgSummary, SidebarSection, UserSummary } from "~/types";

import { SidebarLink } from "./sidebar-link";
import { TeamSwitcher } from "./team-switcher";
import { UserMenu } from "./user-menu";

export interface AppSidebarProps {
  activeOrg: OrgSummary;
  organizations: OrgSummary[];
  user: UserSummary;
  section: SidebarSection;
}

export function AppSidebar({
  activeOrg,
  organizations,
  user,
  section,
}: AppSidebarProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col p-2">
      <TeamSwitcher activeOrg={activeOrg} organizations={organizations} />

      <nav className="mt-2 flex flex-1 flex-col gap-0.5">
        <SidebarLink
          href={`/${activeOrg.slug}`}
          active={section === "channels"}
          icon={<Hash size={16} />}
          label="Channels"
        />
        <SidebarLink
          href={`/${activeOrg.slug}/settings/members`}
          active={section === "members"}
          icon={<Users size={16} />}
          label="Members"
        />
      </nav>

      <UserMenu user={user} />
    </aside>
  );
}

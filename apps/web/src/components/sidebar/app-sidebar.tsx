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
    <aside className="bg-background border-border flex w-56 shrink-0 flex-col border-r">
      <div className="p-2">
        <TeamSwitcher activeOrg={activeOrg} organizations={organizations} />
      </div>

      <nav className="flex-1 space-y-px px-2">
        <SidebarLink
          href={`/${activeOrg.slug}`}
          active={section === "channels"}
          icon={<Hash className="size-3.5" />}
          label="Channels"
        />
        <SidebarLink
          href={`/${activeOrg.slug}/settings/members`}
          active={section === "members"}
          icon={<Users className="size-3.5" />}
          label="Members"
        />
      </nav>

      <div className="border-border border-t p-2">
        <UserMenu user={user} />
      </div>
    </aside>
  );
}

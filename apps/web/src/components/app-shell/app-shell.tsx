import type { ReactNode } from "react";

import { AppSidebar } from "~/components/sidebar/app-sidebar";
import type { OrgSummary, SidebarSection, UserSummary } from "~/types";

import { PageHeader } from "./page-header";

export interface AppShellProps {
  activeOrg: OrgSummary;
  organizations: OrgSummary[];
  user: UserSummary;
  section: SidebarSection;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  activeOrg,
  organizations,
  user,
  section,
  title,
  actions,
  children,
}: AppShellProps) {
  return (
    <div className="bg-background flex h-screen">
      <AppSidebar
        activeOrg={activeOrg}
        organizations={organizations}
        user={user}
        section={section}
      />
      <main className="bg-background-3 m-2 ml-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl shadow-sm">
        <PageHeader title={title} actions={actions} />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl px-5 py-4">{children}</div>
        </div>
      </main>
    </div>
  );
}

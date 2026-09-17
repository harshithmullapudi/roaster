import type { ChannelGroups } from "@roster/api";
import type { ReactNode } from "react";

import { AppSidebar } from "~/components/sidebar/app-sidebar";
import type { OrgSummary, SidebarSection, UserSummary } from "~/types";

import { PageHeader } from "./page-header";

export interface AppShellProps {
  activeOrg: OrgSummary;
  organizations: OrgSummary[];
  user: UserSummary;
  section: SidebarSection;
  channels: ChannelGroups;
  activeChannelSlug?: string;
  title: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}

export function AppShell({
  activeOrg,
  organizations,
  user,
  section,
  channels,
  activeChannelSlug,
  title,
  actions,
  tabs,
  flush,
  children,
}: AppShellProps) {
  return (
    <div className="bg-background flex h-screen">
      <AppSidebar
        activeOrg={activeOrg}
        organizations={organizations}
        user={user}
        section={section}
        channels={channels}
        activeChannelSlug={activeChannelSlug}
      />
      <main className="bg-background-2 shadow-1 m-2 ml-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl">
        <PageHeader title={title} actions={actions} tabs={tabs} />
        {flush ? (
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="flex w-auto flex-col gap-6 p-3 md:w-3xl">
              {children}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

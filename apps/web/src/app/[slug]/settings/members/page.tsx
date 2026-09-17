import { listOrgMembers, listPendingInvitations } from "@roster/api";

import { AppSidebar } from "~/components/app-sidebar";
import { myOrganizations, requireOrg } from "~/lib/session";

import { MembersClient } from "./members-client";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { session, organization, member } = await requireOrg(slug);

  const [organizations, members, invitations] = await Promise.all([
    myOrganizations(session.user.id),
    listOrgMembers(organization.id),
    listPendingInvitations(organization.id),
  ]);

  // Decided on the server. The client hides the controls to match, but it is
  // better-auth that enforces it on every mutation.
  const canManage = member.role === "owner" || member.role === "admin";

  return (
    <div className="flex h-screen">
      <AppSidebar
        activeOrg={organization}
        organizations={organizations}
        user={session.user}
        currentPath="members"
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-8">
          <h1 className="text-lg font-semibold tracking-tight">Members</h1>
          <p className="text-muted-foreground mt-1 mb-6 text-sm">
            Everyone in {organization.name}.
          </p>
          <MembersClient
            organizationId={organization.id}
            members={members}
            invitations={invitations}
            currentUserId={session.user.id}
            canManage={canManage}
          />
        </div>
      </main>
    </div>
  );
}

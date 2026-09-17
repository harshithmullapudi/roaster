import { listOrgMembers, listPendingInvitations } from "@roster/api";

import { InviteForm } from "~/components/members/invite-form";
import { MemberList } from "~/components/members/member-list";
import { PendingInvitations } from "~/components/members/pending-invitations";
import { AppSidebar } from "~/components/sidebar/app-sidebar";
import { myOrganizations, requireOrg } from "~/lib/session";

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

  const canManage = member.role === "owner" || member.role === "admin";

  return (
    <div className="flex h-screen">
      <AppSidebar
        activeOrg={organization}
        organizations={organizations}
        user={session.user}
        section="members"
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-8 py-7">
          <h1 className="text-base font-semibold tracking-tight">Members</h1>
          <p className="text-muted-foreground mt-0.5 mb-5 text-sm">
            Everyone in {organization.name}.
          </p>

          <div className="space-y-6">
            {canManage ? <InviteForm organizationId={organization.id} /> : null}
            <MemberList
              organizationId={organization.id}
              members={members}
              currentUserId={session.user.id}
              canManage={canManage}
            />
            <PendingInvitations
              invitations={invitations}
              canManage={canManage}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

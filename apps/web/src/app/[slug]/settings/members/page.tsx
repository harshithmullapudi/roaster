import { listOrgMembers, listPendingInvitations } from "@roster/api";

import { AppShell } from "~/components/app-shell/app-shell";
import { InviteForm } from "~/components/members/invite-form";
import { MemberList } from "~/components/members/member-list";
import { PendingInvitations } from "~/components/members/pending-invitations";
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
    <AppShell
      activeOrg={organization}
      organizations={organizations}
      user={session.user}
      section="members"
      title="Members"
    >
      <div className="space-y-6">
        {canManage ? <InviteForm organizationId={organization.id} /> : null}
        <MemberList
          organizationId={organization.id}
          members={members}
          currentUserId={session.user.id}
          canManage={canManage}
        />
        <PendingInvitations invitations={invitations} canManage={canManage} />
      </div>
    </AppShell>
  );
}

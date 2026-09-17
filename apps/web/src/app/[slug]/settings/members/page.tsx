import { listOrgMembers, listPendingInvitations } from "@roster/api";

import { AppShell } from "~/components/app-shell/app-shell";
import { InviteForm } from "~/components/members/invite-form";
import { MemberList } from "~/components/members/member-list";
import { PendingInvitations } from "~/components/members/pending-invitations";
import { loadShell } from "~/lib/shell";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { session, organization, shell } = await loadShell(slug);

  const [members, invitations] = await Promise.all([
    listOrgMembers(organization.id),
    listPendingInvitations(organization.id),
  ]);

  return (
    <AppShell shell={shell} section="members" title="Members">
      <div className="space-y-6">
        {shell.can("member:invite") ? (
          <InviteForm organizationId={organization.id} />
        ) : null}
        <MemberList
          organizationId={organization.id}
          members={members}
          currentUserId={session.user.id}
          canManage={shell.can("member:remove")}
        />
        <PendingInvitations
          invitations={invitations}
          canManage={shell.can("member:invite")}
        />
      </div>
    </AppShell>
  );
}

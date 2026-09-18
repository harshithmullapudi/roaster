import { listOrgMembers, listPendingInvitations } from "@roster/api";

import { InviteForm } from "~/components/members/invite-form";
import { MemberList } from "~/components/members/member-list";
import { PendingInvitations } from "~/components/members/pending-invitations";
import { SettingsPage } from "~/components/settings/settings-page";
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
    <SettingsPage
      title="Members"
      description="Everyone in this workspace, and the invitations still open."
    >
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
    </SettingsPage>
  );
}

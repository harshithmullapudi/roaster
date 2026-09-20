import { inviteLink, listOrgMembers, listPendingInvitations } from "@roster/api";
import { headers } from "next/headers";

import { InviteForm } from "~/components/members/invite-form";
import { InviteLinkCard } from "~/components/members/invite-link-card";
import { MemberList } from "~/components/members/member-list";
import { PendingInvitations } from "~/components/members/pending-invitations";
import { SettingsPage } from "~/components/settings/settings-page";
import { loadShell } from "~/lib/shell";

async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host");
  if (!host) return process.env.NEXT_PUBLIC_APP_URL ?? "";

  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  return `${proto}://${host}`;
}

export default async function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { session, organization, shell } = await loadShell(slug);

  const canInvite = shell.can("member:invite");

  const [members, invitations, link, origin] = await Promise.all([
    listOrgMembers(organization.id),
    listPendingInvitations(organization.id),
    canInvite ? inviteLink(organization.id) : null,
    requestOrigin(),
  ]);

  return (
    <SettingsPage
      title="Members"
      description="Everyone in this workspace, and the invitations still open."
    >
      {canInvite ? (
        <>
          <InviteLinkCard link={link} origin={origin} />
          <InviteForm organizationId={organization.id} />
        </>
      ) : null}
      <MemberList
        organizationId={organization.id}
        members={members}
        currentUserId={session.user.id}
        canManage={shell.can("member:remove")}
      />
      <PendingInvitations
        invitations={invitations}
        canManage={canInvite}
        origin={origin}
      />
    </SettingsPage>
  );
}

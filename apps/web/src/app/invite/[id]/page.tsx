import { getInvitationPreview } from "@roster/api";
import { redirect } from "next/navigation";

import { AuthShell } from "~/components/auth-shell";
import { AcceptInvitation } from "~/components/invite/accept-invitation";
import { SignInForm } from "~/components/sign-in/sign-in-form";
import { getSession } from "~/lib/session";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invitation = await getInvitationPreview(id);

  if (!invitation) {
    return (
      <AuthShell title="Invitation not found">
        <p className="text-muted-foreground text-sm">Ask for a new link.</p>
      </AuthShell>
    );
  }

  if (invitation.status === "accepted") {
    redirect(`/${invitation.organization.slug}`);
  }

  if (invitation.expired || invitation.status !== "pending") {
    return (
      <AuthShell title="Invitation expired">
        <p className="text-muted-foreground text-sm">
          Ask {invitation.inviterName} for a new link.
        </p>
      </AuthShell>
    );
  }

  const session = await getSession();

  if (!session) {
    return (
      <AuthShell title={`Join ${invitation.organization.name}`}>
        <p className="text-muted-foreground mb-3 text-sm">
          Invited as {invitation.email}.
        </p>
        <SignInForm callbackURL={`/invite/${invitation.id}`} />
      </AuthShell>
    );
  }

  const emailMatches =
    session.user.email.toLowerCase() === invitation.email.toLowerCase();

  if (!emailMatches) {
    return (
      <AuthShell title={`Join ${invitation.organization.name}`}>
        <p className="text-muted-foreground text-sm">
          This invitation is for {invitation.email}, but you&rsquo;re signed in
          as {session.user.email}.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={`Join ${invitation.organization.name}`}>
      <AcceptInvitation
        invitationId={invitation.id}
        slug={invitation.organization.slug}
      />
    </AuthShell>
  );
}

import { getInvitationPreview } from "@roster/api";
import { redirect } from "next/navigation";

import { AuthShell } from "~/components/auth-shell";
import { AcceptInvitation } from "~/components/invite/accept-invitation";
import { SwitchAccount } from "~/components/invite/switch-account";
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
          {invitation.inviterName} invited {invitation.email}.
        </p>
        <SignInForm
          callbackURL={`/invite/${invitation.id}`}
          initialEmail={invitation.email}
        />
      </AuthShell>
    );
  }

  const emailMatches =
    session.user.email.toLowerCase() === invitation.email.toLowerCase();

  if (!emailMatches) {
    return (
      <AuthShell title={`Join ${invitation.organization.name}`}>
        <p className="text-muted-foreground mb-3 text-sm">
          This invitation is for {invitation.email}, but you&rsquo;re signed in
          as {session.user.email}.
        </p>
        <SwitchAccount email={invitation.email} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title={`Join ${invitation.organization.name}`}>
      <p className="text-muted-foreground mb-3 text-sm">
        {invitation.inviterName} invited you.
      </p>
      <AcceptInvitation
        invitationId={invitation.id}
        initialUserName={session.user.name ?? ""}
      />
    </AuthShell>
  );
}

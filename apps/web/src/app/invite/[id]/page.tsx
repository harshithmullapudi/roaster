import { getInvitationPreview } from "@roster/api";
import { redirect } from "next/navigation";

import { AuthShell } from "~/components/auth-shell";
import { SignInForm } from "~/app/sign-in/sign-in-form";
import { getSession } from "~/lib/session";

import { AcceptInvitation } from "./accept-invitation";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invitation = await getInvitationPreview(id);

  if (!invitation) {
    return (
      <AuthShell
        title="This invitation doesn't exist"
        subtitle="The link may be wrong, or the invitation may have been revoked."
      >
        <p className="text-muted-foreground text-sm">
          Ask whoever invited you to send a new one.
        </p>
      </AuthShell>
    );
  }

  if (invitation.status === "accepted") {
    redirect(`/${invitation.organization.slug}`);
  }

  if (invitation.expired || invitation.status !== "pending") {
    return (
      <AuthShell
        title={`This invitation has ${invitation.expired ? "expired" : "been revoked"}`}
        subtitle={`It was for ${invitation.organization.name}.`}
      >
        <p className="text-muted-foreground text-sm">
          Ask {invitation.inviterName} to send a new one.
        </p>
      </AuthShell>
    );
  }

  const session = await getSession();

  if (!session) {
    return (
      <AuthShell
        title={`Join ${invitation.organization.name}`}
        subtitle={
          <>
            {invitation.inviterName} invited{" "}
            <span className="font-medium">{invitation.email}</span>. Sign in
            with that address to accept.
          </>
        }
      >
        <SignInForm callbackURL={`/invite/${invitation.id}`} />
      </AuthShell>
    );
  }

  // Signed in as the wrong person — a real case, because invitation links get
  // opened on a laptop that is already signed in as someone else.
  const emailMatches =
    session.user.email.toLowerCase() === invitation.email.toLowerCase();

  if (!emailMatches) {
    return (
      <AuthShell
        title={`Join ${invitation.organization.name}`}
        subtitle={
          <>
            This invitation is for{" "}
            <span className="font-medium">{invitation.email}</span>, but you're
            signed in as{" "}
            <span className="font-medium">{session.user.email}</span>.
          </>
        }
        footer="Sign out and open the link again to accept it."
      >
        <p className="text-muted-foreground text-sm">
          Accepting would put the wrong account in the team, so Roster won't do
          it.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Join ${invitation.organization.name}`}
      subtitle={`${invitation.inviterName} invited you.`}
      footer={`Signed in as ${session.user.email}.`}
    >
      <AcceptInvitation
        invitationId={invitation.id}
        slug={invitation.organization.slug}
      />
    </AuthShell>
  );
}

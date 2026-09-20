import { claimInviteLink, resolveInviteLink } from "@roster/api";
import { redirect } from "next/navigation";

import { AuthShell } from "~/components/auth-shell";
import { SignInForm } from "~/components/sign-in/sign-in-form";
import { getSession } from "~/lib/session";

const REFUSALS = {
  unknown: "That link doesn't belong to any workspace. Ask for a new one.",
  revoked: "That link has been turned off. Ask for a new one.",
  expired: "That link has expired. Ask for a new one.",
} as const;

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveInviteLink(token);

  if (typeof resolved === "string") {
    return (
      <AuthShell title="This link doesn't work">
        <p className="text-muted-foreground text-sm">{REFUSALS[resolved]}</p>
      </AuthShell>
    );
  }

  const session = await getSession();

  if (!session) {
    return (
      <AuthShell title={`Join ${resolved.organization.name}`}>
        <p className="text-muted-foreground mb-3 text-sm">
          Sign in and you&rsquo;ll be taken straight in.
        </p>
        <SignInForm callbackURL={`/join/${token}`} />
      </AuthShell>
    );
  }

  const claim = await claimInviteLink({
    token,
    userId: session.user.id,
    email: session.user.email,
  });

  if (typeof claim === "string") {
    return (
      <AuthShell title="This link doesn't work">
        <p className="text-muted-foreground text-sm">{REFUSALS[claim]}</p>
      </AuthShell>
    );
  }

  if (claim.alreadyMember) redirect(`/${claim.slug}`);

  redirect(`/invite/${claim.invitationId}`);
}

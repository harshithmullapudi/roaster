import { redirect } from "next/navigation";

import { AuthShell } from "~/components/auth-shell";
import { SignInForm } from "~/components/sign-in/sign-in-form";
import { getSession } from "~/lib/session";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/");

  const { error } = await searchParams;

  return (
    <AuthShell title="Sign in to Roster">
      {error === "desktop" ? (
        <p className="text-muted-foreground mb-3 text-sm">
          That sign-in link had already been used or had expired. Send yourself
          another one.
        </p>
      ) : null}
      <SignInForm />
    </AuthShell>
  );
}

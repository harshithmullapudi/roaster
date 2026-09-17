import { redirect } from "next/navigation";

import { AuthShell } from "~/components/auth-shell";
import { SignInForm } from "~/components/sign-in/sign-in-form";
import { getSession } from "~/lib/session";

export default async function SignInPage() {
  if (await getSession()) redirect("/");

  return (
    <AuthShell title="Sign in to Roster">
      <SignInForm />
    </AuthShell>
  );
}

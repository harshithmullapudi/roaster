import { redirect } from "next/navigation";

import { AuthShell } from "~/components/auth-shell";
import { getSession } from "~/lib/session";

import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  // Signing in while already signed in is a dead end, not an error.
  if (await getSession()) redirect("/");

  return (
    <AuthShell
      title="Sign in to Roster"
      subtitle="We'll email you a link. No password to remember."
      footer="New here? The same link creates your account."
    >
      <SignInForm />
    </AuthShell>
  );
}

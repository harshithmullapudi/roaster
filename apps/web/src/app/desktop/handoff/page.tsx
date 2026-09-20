import { auth } from "@roster/auth";
import { headers } from "next/headers";

import { AuthShell } from "~/components/auth-shell";
import { HandoffRedirect } from "~/components/desktop/handoff-redirect";
import { requireSession } from "~/lib/session";
import { safeNext } from "~/utils/desktop-session";

export default async function DesktopHandoffPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requireSession();

  const { next } = await searchParams;

  let token: string | undefined;
  try {
    ({ token } = await auth.api.generateOneTimeToken({
      headers: await headers(),
    }));
  } catch {
    token = undefined;
  }

  if (!token) {
    return (
      <AuthShell title="Could not reach the app">
        <p className="text-muted-foreground text-sm">
          Something went wrong handing this session to Roster. Open the app and
          sign in again.
        </p>
      </AuthShell>
    );
  }

  const deepLink = new URL("roster://auth");
  deepLink.searchParams.set("token", token);
  if (next) deepLink.searchParams.set("next", safeNext(next));

  return (
    <AuthShell title="Opening Roster">
      <HandoffRedirect deepLink={deepLink.toString()} />
    </AuthShell>
  );
}

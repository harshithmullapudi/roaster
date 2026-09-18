import { auth } from "@roster/auth";

import { desktopSession } from "~/utils/desktop-session";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  return desktopSession({
    token: params.get("token"),
    next: params.get("next"),
    verify: (value) =>
      auth.api.verifyOneTimeToken({
        body: { token: value },
        asResponse: true,
      }),
  });
}

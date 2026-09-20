const SIGN_IN = "/sign-in?error=desktop";

const IN_APP_PATH = /^\/(?![/\\])\S*$/;

export function safeNext(next: string | null | undefined): string {
  return next && IN_APP_PATH.test(next) ? next : "/";
}

export interface DesktopSessionOptions {
  token: string | null | undefined;
  next?: string | null;
  verify: (token: string) => Promise<Response>;
}

function seeOther(location: string, cookies: string[] = []) {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}

export async function desktopSession({
  token,
  next,
  verify,
}: DesktopSessionOptions): Promise<Response> {
  if (!token?.trim()) return seeOther(SIGN_IN);

  try {
    const verified = await verify(token);
    if (!verified.ok) return seeOther(SIGN_IN);
    return seeOther(safeNext(next), verified.headers.getSetCookie());
  } catch {
    return seeOther(SIGN_IN);
  }
}

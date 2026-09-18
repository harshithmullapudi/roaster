/**
 * The desktop shell's half of magic-link sign-in.
 *
 * A magic link clicked in a mail client opens the default browser, so the
 * session cookie better-auth sets lands there and the app's webview stays
 * signed out. The browser instead mints a one-time token, hands it to the app
 * over `roster://`, and the app navigates here. Verifying the token server-side
 * puts `Set-Cookie` on a response the webview itself received — the cookie ends
 * up in the right jar without anyone touching a cookie API.
 */

const SIGN_IN = "/sign-in?error=desktop";

/**
 * The destination survives a round trip through a `roster://` URL, so by the
 * time it gets here anything could be in it. Only same-origin paths are
 * honoured: a protocol-relative `//host` or a backslash variant would send the
 * webview somewhere else entirely.
 */
const IN_APP_PATH = /^\/(?![/\\])\S*$/;

export function safeNext(next: string | null | undefined): string {
  return next && IN_APP_PATH.test(next) ? next : "/";
}

export interface DesktopSessionOptions {
  token: string | null | undefined;
  /** Where sign-in was headed before the handoff. Defaults to the root. */
  next?: string | null;
  /** Verifies the one-time token and returns better-auth's raw response. */
  verify: (token: string) => Promise<Response>;
}

/**
 * Relative `Location` on purpose: behind Railway's proxy the request URL is not
 * reliably the public one, and anything absolute risks bouncing the webview to
 * an internal hostname.
 */
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

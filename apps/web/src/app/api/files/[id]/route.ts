import { readAttachment, readAttachmentWithKey } from "@roster/api";

import { getSession } from "~/lib/session";

/**
 * Reading an attachment back. Files are not served from the uploads directory
 * statically: every read passes through here, where the reader is checked
 * against the organization and channel the file was posted in.
 *
 * Two kinds of reader arrive: a browser with a session cookie, and an agent
 * session carrying a `roster` API key. The agent is handed these URLs in its
 * prompt, so without the key it would be told about a file it cannot open.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";

  const file = token
    ? await readAttachmentWithKey({ token, attachmentId: id })
    : await readWithSession(id);

  if (file === "unauthorized") return new Response("Unauthorized", { status: 401 });
  if (!file) return new Response("Not found", { status: 404 });

  const download = new URL(request.url).searchParams.has("download");
  const disposition = download ? "attachment" : "inline";

  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      /**
       * Only images and PDFs are ever stored — the type is sniffed from the
       * bytes on upload, so HTML or SVG never reaches this route to be served
       * inline. `nosniff` holds a browser to that stored type, and `default-src
       * 'none'` means nothing a file references can be fetched. Full CSP
       * sandboxing is deliberately not set: it stops Chrome rendering the PDF
       * in its own viewer, which is the preview.
       */
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      /** Contents never change — the id is minted per upload. */
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

async function readWithSession(attachmentId: string) {
  const session = await getSession();
  if (!session) return "unauthorized" as const;
  return readAttachment({ userId: session.user.id, attachmentId });
}

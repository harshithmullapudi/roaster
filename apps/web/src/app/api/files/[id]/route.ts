import { readAttachment } from "@roster/api";

import { getSession } from "~/lib/session";

/**
 * Reading an attachment back. Files are not served from the uploads directory
 * statically: every read passes through here, where the reader is checked
 * against the organization and channel the file was posted in.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await context.params;
  const file = await readAttachment({ userId: session.user.id, attachmentId: id });
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

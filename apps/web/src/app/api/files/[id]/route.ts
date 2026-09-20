import { readAttachment, readAttachmentWithKey } from "@roster/api";

import { getSession } from "~/lib/session";

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
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

async function readWithSession(attachmentId: string) {
  const session = await getSession();
  if (!session) return "unauthorized" as const;
  return readAttachment({ userId: session.user.id, attachmentId });
}

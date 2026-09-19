import {
  ATTACHMENT_REFUSALS,
  MAX_ATTACHMENT_BYTES,
  uploadAttachment,
} from "@roster/api";

import { getSession } from "~/lib/session";

/**
 * Where a file becomes an attachment. This is a REST route rather than a tRPC
 * procedure because the tRPC client batches over JSON — bytes would have to be
 * base64'd through it, a third larger and held in memory twice.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_ATTACHMENT_BYTES * 1.1) {
    // Refuse on the header rather than reading a body we would throw away.
    return refusal(ATTACHMENT_REFUSALS["too-large"], 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refusal("That upload could not be read.", 400);
  }

  const projectId = form.get("projectId");
  const file = form.get("file");
  if (typeof projectId !== "string" || !(file instanceof File)) {
    return refusal("Missing file.", 400);
  }

  const result = await uploadAttachment({
    userId: session.user.id,
    projectId,
    filename: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });

  if ("refusal" in result) {
    if (result.refusal === "no-access") {
      return refusal("That channel is not yours to post in.", 403);
    }
    return refusal(
      ATTACHMENT_REFUSALS[result.refusal],
      result.refusal === "too-large" ? 413 : 400,
    );
  }

  return Response.json(result.attachment, { status: 201 });
}

function refusal(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

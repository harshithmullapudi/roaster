import { authorizeTerminalStream } from "@roster/api";

import { getSession } from "~/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const params = new URL(request.url).searchParams;
  const slug = params.get("slug");
  const projectId = params.get("projectId");
  const workspaceId = params.get("workspaceId");
  const terminalId = params.get("terminalId");
  if (!slug || !projectId || !workspaceId || !terminalId) {
    return new Response("Missing parameters", { status: 400 });
  }

  const relayUrl = await authorizeTerminalStream({
    userId: session.user.id,
    slug,
    projectId,
    workspaceId,
    terminalId,
    seq: "new",
  });
  if (!relayUrl) return new Response("Not found", { status: 404 });

  const cols = positiveInt(params.get("cols")) ?? 80;
  const rows = positiveInt(params.get("rows")) ?? 24;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const socket = new WebSocket(relayUrl);
      socket.binaryType = "arraybuffer";

      const emit = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          closed = true;
        }
      };

      const shutdown = () => {
        if (closed) return;
        closed = true;
        try {
          socket.close();
        } catch {}
        try {
          controller.close();
        } catch {}
      };

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "visible", visible: true }));
        socket.send(JSON.stringify({ type: "resize", cols, rows }));
      };

      socket.onmessage = (event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
          emit("output", Buffer.from(event.data).toString("base64"));
          return;
        }

        const raw = String(event.data);
        let message: { type?: unknown };
        try {
          message = JSON.parse(raw) as { type?: unknown };
        } catch {
          return;
        }

        if (message.type === "ping") {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "pong" }));
          }
          return;
        }

        emit("control", raw);

        if (message.type === "exit" || message.type === "error") shutdown();
      };

      socket.onerror = () => {
        emit("control", JSON.stringify({ type: "error", message: "stream failed" }));
        shutdown();
      };

      socket.onclose = () => shutdown();

      request.signal.addEventListener("abort", shutdown);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function positiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

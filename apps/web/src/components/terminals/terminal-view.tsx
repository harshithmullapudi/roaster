"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";

import { trpc } from "~/utils/trpc";

import "@xterm/xterm/css/xterm.css";

export type StreamState = "connecting" | "open" | "ended" | "error";

export interface TerminalViewProps {
  orgSlug: string;
  projectId: string;
  workspaceId: string;
  terminalId: string;
  onStateChange?: (state: StreamState) => void;
}

const WRITE_DEBOUNCE_MS = 16;
const RESIZE_DEBOUNCE_MS = 300;

function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function TerminalView({
  orgSlug,
  projectId,
  workspaceId,
  terminalId,
  onStateChange,
}: TerminalViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [size, setSize] = useState<{ cols: number; rows: number } | null>(null);

  const stateRef = useRef(onStateChange);
  stateRef.current = onStateChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal({
      fontSize: 12,
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      scrollback: 5000,
      convertEol: false,
      cursorBlink: true,
      theme: { background: "#0a0a0a", foreground: "#e5e5e5" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;
    setSize({ cols: term.cols, rows: term.rows });

    let pending = "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timer = null;
      const data = pending;
      pending = "";
      if (!data) return;
      void trpc.terminals.write
        .mutate({ projectId, workspaceId, terminalId, data })
        .catch(() => undefined);
    };

    const typed = term.onData((data) => {
      pending += data;
      if (timer === null) timer = setTimeout(flush, WRITE_DEBOUNCE_MS);
    });

    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {}
    });
    observer.observe(host);

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resized = term.onResize(({ cols, rows }) => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => setSize({ cols, rows }), RESIZE_DEBOUNCE_MS);
    });

    return () => {
      observer.disconnect();
      typed.dispose();
      resized.dispose();
      if (timer) clearTimeout(timer);
      if (resizeTimer) clearTimeout(resizeTimer);
      flush();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [projectId, workspaceId, terminalId]);

  useEffect(() => {
    if (!size) return;
    const term = termRef.current;
    if (!term) return;

    stateRef.current?.("connecting");

    const query = new URLSearchParams({
      slug: orgSlug,
      projectId,
      workspaceId,
      terminalId,
      cols: String(size.cols),
      rows: String(size.rows),
    });
    const source = new EventSource(`/api/terminals/stream?${query.toString()}`);

    source.addEventListener("output", (event) => {
      term.write(decode((event as MessageEvent<string>).data));
    });

    source.addEventListener("control", (event) => {
      let message: { type?: unknown };
      try {
        message = JSON.parse((event as MessageEvent<string>).data) as {
          type?: unknown;
        };
      } catch {
        return;
      }
      if (message.type === "attached") stateRef.current?.("open");
      else if (message.type === "exit") stateRef.current?.("ended");
      else if (message.type === "error") stateRef.current?.("error");
    });

    source.onerror = () => stateRef.current?.("error");

    return () => source.close();
  }, [orgSlug, projectId, workspaceId, terminalId, size]);

  return <div ref={hostRef} className="h-full w-full" />;
}

import { redact } from "@roster/superset";

const MAX_SENTENCE = 140;
const STATUS_IN_TEXT = /failed with (\d{3})/;
const TIMEOUT = /timeout|timed out|aborted|abortsignal/i;
const OFFLINE = /not online|offline|unreachable|could not reach|econnrefused|enotfound|fetch failed/i;
const ENVELOPE = /[[{]/;
const MACHINE_SHAPED = /[[{]|failed with \d{3}|returned invalid JSON/;
const LETTER = /[A-Za-z]/;

export interface SessionErrorOptions {
  fallback: string;
  retrying?: boolean;
}

export function sessionErrorDetail(cause: unknown): string {
  const raw =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : "";
  return redact(raw).slice(0, 500);
}

function statusOf(cause: unknown, text: string): number | null {
  if (typeof cause === "object" && cause !== null && "status" in cause) {
    const status = (cause as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  const match = STATUS_IN_TEXT.exec(text);
  return match?.[1] ? Number(match[1]) : null;
}

function plainSentence(text: string): string | null {
  if (ENVELOPE.test(text)) return null;
  const trimmed = text.trim().replace(/[:\s]+$/, "");
  if (trimmed.length === 0 || !LETTER.test(trimmed)) return null;
  const sentence =
    trimmed.length > MAX_SENTENCE
      ? `${trimmed.slice(0, MAX_SENTENCE - 1).trimEnd()}…`
      : trimmed;
  return /[.!?…]$/.test(sentence) ? sentence : `${sentence}.`;
}

export function humanSessionError(
  cause: unknown,
  options: SessionErrorOptions,
): string {
  const text = sessionErrorDetail(cause);
  const status = statusOf(cause, text);
  const suffix = options.retrying ? " Retrying…" : "";

  if (TIMEOUT.test(text)) return "The agent stopped responding.";
  if (status === 503 || OFFLINE.test(text)) {
    return `That machine went offline.${suffix}`;
  }
  if (status === 401 || status === 403) {
    return "Superset rejected this team's key. Reconnect it in Settings.";
  }
  if (status === 404) return "That session is no longer on the machine.";
  if (status === 429) return `Superset is busy right now.${suffix}`;
  if (status !== null && status >= 500) {
    return `Superset could not reach that machine.${suffix}`;
  }

  return plainSentence(text) ?? options.fallback;
}

const GONE_STATUSES = new Set([404, 409]);

export function workspaceAlreadyGone(cause: unknown): boolean {
  const text = sessionErrorDetail(cause);
  const status = statusOf(cause, text);
  return status !== null && GONE_STATUSES.has(status);
}

export function readableError(stored: string | null): string | null {
  if (stored === null) return null;
  if (!MACHINE_SHAPED.test(stored)) return redact(stored);
  return humanSessionError(stored, {
    fallback: "Something went wrong on that machine.",
  });
}

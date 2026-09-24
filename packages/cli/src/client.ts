import type { Config } from "./config.js";

export class RosterError extends Error {}

function serialize(input: unknown): string {
  return JSON.stringify({ json: input });
}

const FLAGS: Record<string, string> = {
  channelId: "--channel-id",
  threadId: "--thread",
  apiUrl: "--api-url",
  limit: "--limit",
  out: "--out",
};

interface Issue {
  message: string;
  path?: unknown[];
}

function isIssue(value: unknown): value is Issue {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Issue).message === "string"
  );
}

export function readableError(message: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(message);
  } catch {
    return message;
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return message;
  if (!parsed.every(isIssue)) return message;

  return parsed
    .map((issue) => {
      const field = (issue.path ?? []).join(".");
      if (!field) return issue.message;
      return `${FLAGS[field] ?? field}: ${issue.message}`;
    })
    .join("; ");
}

function unwrap(raw: string, what: string): unknown {
  let parsed: {
    result?: { data?: { json?: unknown } | unknown };
    error?: { json?: { message?: string }; message?: string };
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RosterError(`${what}: server sent invalid JSON.`);
  }

  if (parsed.error) {
    const message =
      parsed.error.json?.message ?? parsed.error.message ?? "unknown error";
    throw new RosterError(readableError(message));
  }

  const data = parsed.result?.data;
  if (data && typeof data === "object" && "json" in data) {
    return (data as { json: unknown }).json;
  }
  return data;
}

async function call(
  config: Config,
  procedure: string,
  input: unknown,
  method: "GET" | "POST",
): Promise<unknown> {
  const base = `${config.apiUrl.replace(/\/$/, "")}/api/trpc/${procedure}`;
  const url =
    method === "GET"
      ? `${base}?input=${encodeURIComponent(serialize(input))}`
      : base;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: method === "POST" ? serialize(input) : undefined,
    });
  } catch (cause) {
    throw new RosterError(
      `Could not reach Roster at ${config.apiUrl}. ${(cause as Error).message}`,
    );
  }

  const raw = await response.text();

  if (response.status === 401 && !raw.trimStart().startsWith("{")) {
    throw new RosterError(
      "This machine is not logged in to Roster. Run `roster login`.",
    );
  }

  return unwrap(raw, procedure);
}

export function query(
  config: Config,
  procedure: string,
  input: unknown = {},
): Promise<unknown> {
  return call(config, procedure, input, "GET");
}

export function mutate(
  config: Config,
  procedure: string,
  input: unknown = {},
): Promise<unknown> {
  return call(config, procedure, input, "POST");
}

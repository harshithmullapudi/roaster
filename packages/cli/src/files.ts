import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { RosterError } from "./client.js";
import type { Config } from "./config.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function attachmentIdFrom(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (UUID.test(trimmed)) return trimmed;

  const match = trimmed.match(
    /\/api\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  return match?.[1] ?? null;
}

export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;

  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded?.[1]) {
    try {
      return sanitize(decodeURIComponent(encoded[1]));
    } catch {
      return sanitize(encoded[1]);
    }
  }

  const plain = header.match(/filename="([^"]+)"/i) ?? header.match(/filename=([^;]+)/i);
  return plain?.[1] ? sanitize(plain[1]) : null;
}

function sanitize(name: string): string {
  const base = name.split(/[\\/]/).pop()?.trim() ?? "";
  return base.length > 0 && base !== "." && base !== ".." ? base : "";
}

export function downloadTarget(args: {
  out?: string;
  filename: string;
  isDirectory: (path: string) => boolean;
}): string {
  const fallback = args.filename.length > 0 ? args.filename : "attachment";
  if (!args.out) return resolve(fallback);

  const out = resolve(args.out);
  return args.isDirectory(out) ? join(out, fallback) : out;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export interface DownloadedFile {
  path: string;
  bytes: number;
}

export async function downloadAttachment(
  config: Config,
  args: { input: string; out?: string },
): Promise<DownloadedFile> {
  const id = attachmentIdFrom(args.input);
  if (!id) {
    throw new RosterError(
      "That is not an attachment. Pass the file's URL from the message, or its id.",
    );
  }

  const url = `${config.apiUrl.replace(/\/$/, "")}/api/files/${id}?download`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { authorization: `Bearer ${config.token}` },
    });
  } catch (cause) {
    throw new RosterError(`Could not reach Roster: ${(cause as Error).message}`);
  }

  if (response.status === 401) {
    throw new RosterError(
      "Roster did not accept this machine's key. Run `roster login`.",
    );
  }
  if (response.status === 404) {
    throw new RosterError(
      "No such file — it may have been deleted, or it is in a channel this key cannot see.",
    );
  }
  if (!response.ok) {
    throw new RosterError(`Roster answered ${response.status} for that file.`);
  }

  const target = downloadTarget({
    out: args.out,
    filename:
      filenameFromDisposition(response.headers.get("content-disposition")) ?? id,
    isDirectory,
  });

  const bytes = Buffer.from(await response.arrayBuffer());
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);

  return { path: target, bytes: bytes.length };
}

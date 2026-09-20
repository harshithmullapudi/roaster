import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { RosterError } from "./client.js";
import type { Config } from "./config.js";

/**
 * Fetching a file someone attached to a message.
 *
 * An agent reads the URL out of the message it was given and passes it
 * straight back in, so both a bare id and a full URL have to work. The key
 * comes from the stored config the way every other command's does — nothing
 * about a credential belongs in the text an agent is handed.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The attachment id in whatever the agent pasted: an id, or a URL holding one. */
export function attachmentIdFrom(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (UUID.test(trimmed)) return trimmed;

  const match = trimmed.match(
    /\/api\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  return match?.[1] ?? null;
}

/**
 * The name the server says the file has. Roster sends the RFC 5987 form, but
 * the plain one is read too so this does not depend on that staying true.
 */
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

/**
 * Where the bytes land. `--out` naming a directory means "in here, under the
 * name it already has" — which is what an agent means by `--out .`.
 */
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

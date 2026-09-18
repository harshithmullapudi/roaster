/**
 * Who a message summons.
 *
 * A mention is the one thing in a channel that means "I am talking to you",
 * so it is what lets a message wake a paused channel. Two spellings count,
 * and they are trusted differently:
 *
 * - A `mention` node, inserted from the composer's autocomplete. The typist
 *   picked it off a list, so it is deliberate by construction and counts even
 *   if the handle has since been renamed away.
 * - A bare `@handle` in the prose, which counts only when it names an agent
 *   the caller can actually see. Anything else is just an at-sign, and waking
 *   an agent for "@here" or an email address would be worse than silence.
 */

/** Tiptap's default name for the node `@tiptap/extension-mention` inserts. */
const MENTION_NODE = "mention";

/** A handle runs until its characters do — see `agentHandle`. */
const TRAILING = /[a-z0-9-]+/y;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const handle = value.trim().toLowerCase().replace(/^@/, "");
  return handle.length > 0 ? handle : null;
}

/**
 * Handles named by a `mention` node anywhere in the document. The node can sit
 * at any depth — inside a list item, a blockquote, a table cell — so the walk
 * recurses rather than assuming the composer's usual doc > paragraph shape.
 */
function nodeHandles(body: unknown): string[] {
  const found: string[] = [];

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (!isRecord(node)) return;

    if (node.type === MENTION_NODE) {
      const attrs = isRecord(node.attrs) ? node.attrs : {};
      // `label` is the handle; `id` is the channel UUID, kept only as a
      // fallback for nodes written before labels were required.
      const handle = normalizeHandle(attrs.label) ?? normalizeHandle(attrs.id);
      if (handle) found.push(handle);
      return;
    }

    walk(node.content);
  };

  walk(body);
  return found;
}

/**
 * Handles typed out by hand. Candidates are tried longest-first because both
 * halves of a handle may contain hyphens, so "@fern-core-web" must never be
 * read as "@fern-core" — the same rule the composer decorates by.
 */
function textHandles(text: string, known: string[]): string[] {
  if (known.length === 0) return [];

  const byLength = [...known].sort((a, b) => b.length - a.length);
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (let index = 0; index < lower.length; index += 1) {
    if (lower[index] !== "@") continue;

    // Only at a word boundary, so the "@" in an email is not a mention.
    const before = index > 0 ? (lower[index - 1] ?? "") : "";
    if (before && /[a-z0-9-]/.test(before)) continue;

    TRAILING.lastIndex = index + 1;
    const run = TRAILING.exec(lower);
    if (!run) continue;

    for (const candidate of byLength) {
      if (!run[0].startsWith(candidate)) continue;
      found.push(candidate);
      index += candidate.length;
      break;
    }
  }

  return found;
}

/**
 * Every agent this message names, deduped, chips before prose.
 *
 * `known` is the handles the author could have mentioned — pass the caller's
 * visible channels, so a private channel's agent cannot be summoned by someone
 * who cannot see it.
 */
export function mentionedHandles(args: {
  body: unknown;
  text: string;
  known: string[];
}): string[] {
  const known = args.known.map((handle) => handle.toLowerCase());

  return [
    ...new Set([
      ...nodeHandles(args.body),
      ...textHandles(args.text, known),
    ]),
  ];
}

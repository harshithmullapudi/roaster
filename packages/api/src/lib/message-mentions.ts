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
 *
 * Two kinds of handle share the `@` namespace: an agent ("@fern-core") and a
 * person ("@fern", their `members.agent_name`). They are kept apart all the
 * way out because only an agent mention may wake a paused channel — "@fern"
 * is a note to a human, and waking the agent for it undoes the pause.
 */

export type MentionKind = "agent" | "member";

/** Tiptap's default name for the node `@tiptap/extension-mention` inserts. */
const MENTION_NODE = "mention";

/** A handle runs until its characters do — see `agentHandle`. */
const TRAILING = /[a-z0-9-]+/y;

export interface MentionedHandles {
  agents: string[];
  members: string[];
}

interface Candidate {
  handle: string;
  kind: MentionKind;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const handle = value.trim().toLowerCase().replace(/^@/, "");
  return handle.length > 0 ? handle : null;
}

/**
 * Every mention node predates the `kind` attribute by definition if it lacks
 * one — member mentions did not exist when it was written — so absent means
 * agent, and old bodies keep working without a migration.
 */
function nodeKind(attrs: Record<string, unknown>): MentionKind {
  return attrs.kind === "member" ? "member" : "agent";
}

/**
 * Handles named by a `mention` node anywhere in the document. The node can sit
 * at any depth — inside a list item, a blockquote, a table cell — so the walk
 * recurses rather than assuming the composer's usual doc > paragraph shape.
 */
function nodeHandles(body: unknown): MentionedHandles {
  const found: MentionedHandles = { agents: [], members: [] };

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (!isRecord(node)) return;

    if (node.type === MENTION_NODE) {
      const attrs = isRecord(node.attrs) ? node.attrs : {};
      // `label` is the handle; `id` is the channel or member UUID, kept only
      // as a fallback for nodes written before labels were required.
      const handle = normalizeHandle(attrs.label) ?? normalizeHandle(attrs.id);
      if (handle) {
        if (nodeKind(attrs) === "member") found.members.push(handle);
        else found.agents.push(handle);
      }
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
 * read as "@fern-core" — the same rule the composer decorates by. That rule
 * also settles the agent/person pair for free: "@harshith-roster" is longer
 * than "@harshith", so the agent wins the prefix it owns.
 *
 * On an exact tie — the same string is both an agent handle and a person's —
 * the agent wins, because that is what the string meant before people could
 * be mentioned at all.
 */
function textHandles(text: string, candidates: Candidate[]): MentionedHandles {
  const found: MentionedHandles = { agents: [], members: [] };
  if (candidates.length === 0) return found;

  const byLength = [...candidates].sort(
    (a, b) =>
      b.handle.length - a.handle.length ||
      Number(a.kind === "member") - Number(b.kind === "member"),
  );
  const lower = text.toLowerCase();

  for (let index = 0; index < lower.length; index += 1) {
    if (lower[index] !== "@") continue;

    // Only at a word boundary, so the "@" in an email is not a mention.
    const before = index > 0 ? (lower[index - 1] ?? "") : "";
    if (before && /[a-z0-9-]/.test(before)) continue;

    TRAILING.lastIndex = index + 1;
    const run = TRAILING.exec(lower);
    if (!run) continue;

    for (const candidate of byLength) {
      if (!run[0].startsWith(candidate.handle)) continue;
      if (candidate.kind === "member") found.members.push(candidate.handle);
      else found.agents.push(candidate.handle);
      index += candidate.handle.length;
      break;
    }
  }

  return found;
}

/**
 * Everyone this message names, deduped, chips before prose, split by kind.
 *
 * `agents` and `members` are the handles the author could have mentioned —
 * pass the caller's visible channels and their organization's people, so a
 * private channel's agent cannot be summoned by someone who cannot see it.
 */
export function mentionedHandles(args: {
  body: unknown;
  text: string;
  agents: string[];
  members?: string[];
}): MentionedHandles {
  const candidates: Candidate[] = [
    ...args.agents.map((handle) => ({
      handle: handle.toLowerCase(),
      kind: "agent" as const,
    })),
    ...(args.members ?? []).map((handle) => ({
      handle: handle.toLowerCase(),
      kind: "member" as const,
    })),
  ];

  const chips = nodeHandles(args.body);
  const typed = textHandles(args.text, candidates);

  return {
    agents: [...new Set([...chips.agents, ...typed.agents])],
    members: [...new Set([...chips.members, ...typed.members])],
  };
}

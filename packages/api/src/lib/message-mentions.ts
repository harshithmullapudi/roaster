export type MentionKind = "agent" | "member";

const MENTION_NODE = "mention";

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

function nodeKind(attrs: Record<string, unknown>): MentionKind {
  return attrs.kind === "member" ? "member" : "agent";
}

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

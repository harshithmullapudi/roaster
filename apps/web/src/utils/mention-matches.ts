import type { MentionItem, MentionKind } from "./mentions";

export interface MentionMatch {
  /** Offset of the "@" within the text. */
  from: number;
  /** Offset just past the handle. */
  to: number;
  handle: string;
  kind: MentionKind;
}

/** A handle ends where handle characters end. */
const TRAILING = /[a-z0-9-]+/y;

/**
 * Finds `@handle` runs that name an agent we know about.
 *
 * Unknown handles are deliberately left as plain text — styling `@anyone`
 * would promise a link that goes nowhere. Candidates are tried longest-first
 * so "@fern-core-web" is never truncated to "@fern-core", which matters
 * because both halves of a handle may contain hyphens — and is also what
 * keeps the agent "@harshith-roster" from being read as the person
 * "@harshith". On an exact tie the agent wins, which is how the string read
 * before people could be mentioned at all.
 */
export function findMentions(
  text: string,
  candidates: MentionItem[],
): MentionMatch[] {
  if (candidates.length === 0) return [];

  const byLength = [...candidates].sort(
    (a, b) =>
      b.handle.length - a.handle.length ||
      Number(a.kind === "member") - Number(b.kind === "member"),
  );
  const lower = text.toLowerCase();
  const matches: MentionMatch[] = [];

  for (let index = 0; index < text.length; index += 1) {
    if (lower[index] !== "@") continue;

    // Only at a word boundary, so an email's "@" is not a mention.
    const before = index > 0 ? (lower[index - 1] ?? "") : "";
    if (before && /[a-z0-9-]/.test(before)) continue;

    TRAILING.lastIndex = index + 1;
    const run = TRAILING.exec(lower);
    if (!run) continue;

    const word = run[0];

    for (const candidate of byLength) {
      if (!word.startsWith(candidate.handle)) continue;

      const to = index + 1 + candidate.handle.length;
      matches.push({
        from: index,
        to,
        handle: candidate.handle,
        kind: candidate.kind,
      });
      index = to - 1;
      break;
    }
  }

  return matches;
}

import type { MentionNodeAttrs } from "@tiptap/extension-mention";

export type MentionKind = "agent" | "member";

export interface MentionItem {
  id: string;
  kind: MentionKind;
  slug: string;
  name: string;
  visibility: string;
  handle: string;
  display: string;
}

export type MentionAttrs = MentionNodeAttrs & { kind: MentionKind };

export function mentionAttrs(item: MentionItem): MentionAttrs {
  return { id: item.id, label: item.handle, kind: item.kind };
}

const MAX_SUGGESTIONS = 8;

const NO_MATCH = 99;

function rank(item: MentionItem, needle: string): number {
  const name = item.name.toLowerCase();

  if (item.handle === needle) return 0;
  if (item.handle.startsWith(needle)) return 1;
  if (item.slug.startsWith(needle) || name.startsWith(needle)) return 2;
  if (item.handle.includes(needle)) return 3;
  if (item.slug.includes(needle) || name.includes(needle)) return 4;
  return NO_MATCH;
}

export function filterMentions(
  items: MentionItem[],
  query: string,
): MentionItem[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return items.slice(0, MAX_SUGGESTIONS);

  return items
    .map((item) => ({ item, score: rank(item, needle) }))
    .filter((entry) => entry.score !== NO_MATCH)
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_SUGGESTIONS)
    .map((entry) => entry.item);
}

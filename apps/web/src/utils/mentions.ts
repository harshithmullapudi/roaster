import type { MentionNodeAttrs } from "@tiptap/extension-mention";

/** An agent lives in a channel; a member is a person on the team. */
export type MentionKind = "agent" | "member";

/**
 * One entry in the composer's `@` autocomplete: a channel, addressed through
 * the agent that lives in it, or a person on the team.
 *
 * Both shapes share the fields because `@` is one namespace and the popup is
 * one ranked list. For a person, `slug` repeats the handle and `visibility` is
 * always "public" — a person is not private to anyone.
 */
export interface MentionItem {
  id: string;
  kind: MentionKind;
  slug: string;
  name: string;
  visibility: string;
  handle: string;
  display: string;
}

/**
 * The whole of what Tiptap's mention node stores. Anything else handed to the
 * suggestion's `command` is dropped by the schema, and Tiptap's own type is
 * what the extension's generics expect — declaring a narrower one here makes
 * `Mention.configure` reject the suggestion. `kind` is ours, declared by
 * `addAttributes` in `tiptap-extensions`.
 */
export type MentionAttrs = MentionNodeAttrs & { kind: MentionKind };

/**
 * Both halves of the mention node — its HTML and its plain text — render
 * `label ?? id`, and `id` is the channel's UUID. So a node inserted without a
 * label reads "@522cf3d5-47bc-…" on screen, and `renderText` ships that same
 * UUID to the agent as its prompt instead of a handle it can resolve.
 *
 * `kind` rides along so the stored body says whether a person or an agent was
 * addressed — the parser cannot tell from the handle alone once the list the
 * typist picked from is gone.
 */
export function mentionAttrs(item: MentionItem): MentionAttrs {
  return { id: item.id, label: item.handle, kind: item.kind };
}

const MAX_SUGGESTIONS = 8;

const NO_MATCH = 99;

/**
 * How well one entry answers the query: the handle spelled out in full beats
 * a handle it only starts, which beats a name that merely contains the word.
 *
 * People and agents share the scale on purpose — the list is ranked by fit,
 * not partitioned by kind. That is also what puts the person "@ash" above the
 * agent "@ash-web" when the typist has typed exactly "ash", and the reverse
 * once they type the hyphen.
 */
function rank(item: MentionItem, needle: string): number {
  const name = item.name.toLowerCase();

  if (item.handle === needle) return 0;
  if (item.handle.startsWith(needle)) return 1;
  if (item.slug.startsWith(needle) || name.startsWith(needle)) return 2;
  if (item.handle.includes(needle)) return 3;
  if (item.slug.includes(needle) || name.includes(needle)) return 4;
  return NO_MATCH;
}

/**
 * Matches the handle, the channel slug and the channel's display name, so
 * "@core" finds fern-core whether the typist thinks in agents or in channels.
 * For a person the same three fields are their handle and their name, so
 * "@harshith" and "@Harshith Mullapudi" both land.
 */
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

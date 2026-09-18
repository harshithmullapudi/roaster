import type { MentionNodeAttrs } from "@tiptap/extension-mention";

/**
 * One entry in the composer's `@` autocomplete: a channel, addressed through
 * the agent that lives in it.
 */
export interface MentionItem {
  id: string;
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
 * `Mention.configure` reject the suggestion.
 */
export type MentionAttrs = MentionNodeAttrs;

/**
 * Both halves of the mention node — its HTML and its plain text — render
 * `label ?? id`, and `id` is the channel's UUID. So a node inserted without a
 * label reads "@522cf3d5-47bc-…" on screen, and `renderText` ships that same
 * UUID to the agent as its prompt instead of a handle it can resolve.
 */
export function mentionAttrs(item: MentionItem): MentionAttrs {
  return { id: item.id, label: item.handle };
}

const MAX_SUGGESTIONS = 8;

/**
 * Matches the handle, the channel slug and the channel's display name, so
 * "@core" finds fern-core whether the typist thinks in agents or in channels.
 */
export function filterMentions(
  items: MentionItem[],
  query: string,
): MentionItem[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return items.slice(0, MAX_SUGGESTIONS);

  return items
    .filter(
      (item) =>
        item.handle.includes(needle) ||
        item.slug.includes(needle) ||
        item.name.toLowerCase().includes(needle),
    )
    .slice(0, MAX_SUGGESTIONS);
}

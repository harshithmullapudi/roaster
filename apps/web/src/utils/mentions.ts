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

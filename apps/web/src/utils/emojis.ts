export interface EmojiItem {
  hexcode: string;
  unicode: string;
  name: string;
  shortcodes: string[];
  label: string;
  tags: string[];
}

export interface EmojiQuery {
  needle: string;
  complete: boolean;
}

const MIN_QUERY = 2;

const MAX_SUGGESTIONS = 8;

const NO_MATCH = 99;

export function parseEmojiQuery(raw: string): EmojiQuery | null {
  const complete = raw.endsWith(":");
  const needle = (complete ? raw.slice(0, -1) : raw).toLowerCase();

  if (needle.length < MIN_QUERY) return null;
  if (needle.includes(":")) return null;

  return { needle, complete };
}

function rank(item: EmojiItem, needle: string): number {
  const shortcodes = item.shortcodes;
  const tags = item.tags;

  if (shortcodes.some((code) => code === needle)) return 0;
  if (shortcodes.some((code) => code.startsWith(needle))) return 1;
  if (item.label.startsWith(needle)) return 2;
  if (tags.some((tag) => tag === needle)) return 3;
  if (tags.some((tag) => tag.startsWith(needle))) return 4;
  if (shortcodes.some((code) => code.includes(needle))) return 5;
  if (item.label.includes(needle)) return 6;
  if (tags.some((tag) => tag.includes(needle))) return 7;
  return NO_MATCH;
}

export function filterEmojis(
  items: EmojiItem[],
  query: EmojiQuery,
): EmojiItem[] {
  const { needle, complete } = query;

  if (complete) {
    const exact = items.find((item) => item.shortcodes.includes(needle));
    return exact ? [exact] : [];
  }

  return items
    .map((item) => ({ item, score: rank(item, needle) }))
    .filter((entry) => entry.score !== NO_MATCH)
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_SUGGESTIONS)
    .map((entry) => entry.item);
}

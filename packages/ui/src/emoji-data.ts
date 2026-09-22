interface CompactEmojiRecord {
  hexcode: string;
  label: string;
  unicode: string;
  group?: number;
  order?: number;
  tags?: string[];
}

export interface EmojiEntry {
  hexcode: string;
  label: string;
  name: string;
  shortcodes: string[];
  unicode: string;
  group: number;
  order: number;
  tags: string[];
  haystack: string;
}

const COMPONENT_GROUP = 2;

let emojiCache: EmojiEntry[] | null = null;
let emojiRequest: Promise<EmojiEntry[]> | null = null;

export function loadedEmojis(): EmojiEntry[] | null {
  return emojiCache;
}

export async function loadEmojis(): Promise<EmojiEntry[]> {
  if (emojiCache) {
    return emojiCache;
  }

  if (!emojiRequest) {
    emojiRequest = Promise.all([
      import("emojibase-data/en/compact.json"),
      import("emojibase-data/en/shortcodes/emojibase.json"),
    ]).then(([compact, shortcodes]) => {
      const records = compact.default as unknown as CompactEmojiRecord[];
      const codes = shortcodes.default as unknown as Record<
        string,
        string | string[] | undefined
      >;

      const entries = records
        .filter(
          (record) =>
            record.group !== undefined && record.group !== COMPONENT_GROUP,
        )
        .map((record) => {
          const shortcode = codes[record.hexcode];
          const names =
            shortcode === undefined
              ? []
              : Array.isArray(shortcode)
                ? shortcode
                : [shortcode];
          const tags = record.tags ?? [];

          return {
            hexcode: record.hexcode,
            label: record.label.toLowerCase(),
            name: names[0] ?? record.label,
            shortcodes: names.length > 0 ? names : [record.label],
            unicode: record.unicode,
            group: record.group ?? 0,
            order: record.order ?? 0,
            tags,
            haystack: [record.label, ...names, ...tags]
              .join(" ")
              .toLowerCase(),
          };
        })
        .sort((a, b) => a.order - b.order);

      emojiCache = entries;

      return entries;
    });
  }

  return emojiRequest;
}

export function searchEmojis(
  entries: EmojiEntry[],
  query: string,
  limit: number,
): EmojiEntry[] {
  const needle = query.trim().toLowerCase();
  const matches: EmojiEntry[] = [];

  for (const entry of entries) {
    if (entry.haystack.includes(needle)) {
      matches.push(entry);

      if (matches.length === limit) {
        break;
      }
    }
  }

  return matches;
}

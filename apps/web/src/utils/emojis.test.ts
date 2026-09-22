import { describe, expect, it } from "vitest";

import { type EmojiItem, filterEmojis, parseEmojiQuery } from "./emojis";

function emoji(
  name: string,
  unicode: string,
  label: string,
  tags: string[] = [],
  extraShortcodes: string[] = [],
): EmojiItem {
  return {
    hexcode: name,
    unicode,
    name,
    shortcodes: [name, ...extraShortcodes],
    label,
    tags,
  };
}

const emojis = [
  emoji("smile", "😄", "grinning face with smiling eyes", ["happy"]),
  emoji("smiley", "😃", "grinning face with big eyes"),
  emoji("smirk", "😏", "smirking face"),
  emoji("heart", "❤️", "red heart", ["love"]),
  emoji("party", "🎉", "party popper", ["celebration", "tada"]),
  emoji("stadium", "🏟️", "stadium", ["arena"]),
  emoji("rocket", "🚀", "rocket", ["ship", "launch"]),
];

describe("parseEmojiQuery", () => {
  it("stays shut until two characters are typed", () => {
    expect(parseEmojiQuery("")).toBeNull();
    expect(parseEmojiQuery("s")).toBeNull();
  });

  it("opens on two characters", () => {
    expect(parseEmojiQuery("sm")).toEqual({ needle: "sm", complete: false });
  });

  it("lowercases the needle", () => {
    expect(parseEmojiQuery("SmIle")).toEqual({
      needle: "smile",
      complete: false,
    });
  });

  it("marks a query complete when the closing colon is typed", () => {
    expect(parseEmojiQuery("smile:")).toEqual({
      needle: "smile",
      complete: true,
    });
  });

  it("rejects a colon in the middle, so times keep working", () => {
    expect(parseEmojiQuery("30:45")).toBeNull();
  });

  it("rejects a bare closing colon", () => {
    expect(parseEmojiQuery(":")).toBeNull();
  });
});

describe("filterEmojis", () => {
  it("ranks shortcode prefixes above label prefixes", () => {
    const names = filterEmojis(emojis, { needle: "smi", complete: false }).map(
      (one) => one.name,
    );
    expect(names).toEqual(["smile", "smiley", "smirk"]);
  });

  it("puts an exact shortcode first", () => {
    const names = filterEmojis(emojis, {
      needle: "smile",
      complete: false,
    }).map((one) => one.name);
    expect(names[0]).toBe("smile");
  });

  it("falls back to the label", () => {
    const names = filterEmojis(emojis, {
      needle: "popper",
      complete: false,
    }).map((one) => one.name);
    expect(names).toEqual(["party"]);
  });

  it("falls back to the tags", () => {
    const names = filterEmojis(emojis, {
      needle: "launch",
      complete: false,
    }).map((one) => one.name);
    expect(names).toEqual(["rocket"]);
  });

  it("ranks a tag prefix above a shortcode substring", () => {
    const names = filterEmojis(emojis, {
      needle: "tad",
      complete: false,
    }).map((one) => one.name);
    expect(names).toEqual(["party", "stadium"]);
  });

  it("matches an alias shortcode, not just the display one", () => {
    const withAlias = [
      emoji("smile", "😄", "grinning face", [], ["grinning"]),
      ...emojis,
    ];
    expect(
      filterEmojis(withAlias, { needle: "grinning", complete: false })[0]?.name,
    ).toBe("smile");
  });

  it("ranks a shortcode prefix above a label match", () => {
    const names = filterEmojis(emojis, {
      needle: "smirk",
      complete: false,
    }).map((one) => one.name);
    expect(names[0]).toBe("smirk");
  });

  it("returns nothing when nothing matches", () => {
    expect(
      filterEmojis(emojis, { needle: "zzzz", complete: false }),
    ).toEqual([]);
  });

  it("keeps only the exact shortcode once the query is complete", () => {
    const names = filterEmojis(emojis, { needle: "smile", complete: true }).map(
      (one) => one.name,
    );
    expect(names).toEqual(["smile"]);
  });

  it("returns nothing for a complete query with no exact shortcode", () => {
    expect(filterEmojis(emojis, { needle: "smi", complete: true })).toEqual([]);
  });

  it("caps the list so the popup stays a popup", () => {
    const many = Array.from({ length: 40 }, (_, index) =>
      emoji(`smile-${index}`, "😄", `smiling face ${index}`),
    );
    expect(filterEmojis(many, { needle: "smile", complete: false })).toHaveLength(
      8,
    );
  });
});

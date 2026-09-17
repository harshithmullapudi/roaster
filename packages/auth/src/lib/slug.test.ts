import { describe, expect, it } from "vitest";

import { nextSlugCandidate, slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates a normal team name", () => {
    expect(slugify("Tegon Labs")).toBe("tegon-labs");
  });

  it("strips accents rather than dropping the letters", () => {
    expect(slugify("Tegón")).toBe("tegon");
  });

  it("collapses runs of punctuation into one hyphen", () => {
    expect(slugify("Red -- Planet // HQ")).toBe("red-planet-hq");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  !Roster!  ")).toBe("roster");
  });

  it("never returns a trailing hyphen after truncation", () => {
    const name = `${"a".repeat(47)} team`;
    const slug = slugify(name);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("falls back to a usable slug when the name has no latin characters", () => {
    expect(slugify("日本語")).toBe("team");
    expect(slugify("!!!")).toBe("team");
  });
});

describe("nextSlugCandidate", () => {
  it("appends the attempt number", () => {
    expect(nextSlugCandidate("tegon", 2)).toBe("tegon-2");
    expect(nextSlugCandidate("tegon", 3)).toBe("tegon-3");
  });

  it("is deterministic — the same base and attempt give the same slug", () => {
    expect(nextSlugCandidate("tegon", 2)).toBe(nextSlugCandidate("tegon", 2));
  });

  it("keeps the result within the length limit", () => {
    const base = "a".repeat(48);
    const candidate = nextSlugCandidate(base, 12);
    expect(candidate.length).toBeLessThanOrEqual(48);
    expect(candidate.endsWith("-12")).toBe(true);
  });

  it("does not produce a double hyphen when the base is truncated at one", () => {
    const base = `${"a".repeat(45)}-bb`;
    expect(nextSlugCandidate(base, 2)).not.toContain("--");
  });
});

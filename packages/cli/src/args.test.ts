import { describe, expect, it } from "vitest";

import { flagNumber, flagString, parseArgs } from "./args.js";

describe("parseArgs", () => {
  it("separates positionals from flags", () => {
    const parsed = parseArgs(["ask", "fern-core", "--thread", "abc"]);
    expect(parsed.positionals).toEqual(["ask", "fern-core"]);
    expect(parsed.flags).toEqual({ thread: "abc" });
  });

  it("accepts --flag=value as well as --flag value", () => {
    expect(parseArgs(["--limit=5"]).flags).toEqual({ limit: "5" });
    expect(parseArgs(["--limit", "5"]).flags).toEqual({ limit: "5" });
  });

  it("treats a flag with no value as a switch", () => {
    expect(parseArgs(["--help"]).flags).toEqual({ help: true });
  });

  it("does not swallow the next flag as a value", () => {
    const parsed = parseArgs(["--help", "--limit", "5"]);
    expect(parsed.flags).toEqual({ help: true, limit: "5" });
  });

  it("keeps an unquoted multi-word task as positionals", () => {
    const parsed = parseArgs([
      "ask",
      "fern-core",
      "fix",
      "the",
      "flaky",
      "test",
      "--thread",
      "t1",
    ]);
    expect(parsed.positionals.slice(2).join(" ")).toBe("fix the flaky test");
    expect(flagString(parsed, "thread")).toBe("t1");
  });

  it("handles an empty argv", () => {
    expect(parseArgs([])).toEqual({ positionals: [], flags: {} });
  });
});

describe("flagString", () => {
  it("returns undefined for a switch, which has no value", () => {
    expect(flagString(parseArgs(["--thread"]), "thread")).toBeUndefined();
  });

  it("returns undefined for a flag that was not passed", () => {
    expect(flagString(parseArgs([]), "thread")).toBeUndefined();
  });
});

describe("flagNumber", () => {
  it("parses a numeric flag", () => {
    expect(flagNumber(parseArgs(["--limit", "25"]), "limit")).toBe(25);
  });

  it("rejects a non-numeric value rather than yielding NaN", () => {
    expect(flagNumber(parseArgs(["--limit", "lots"]), "limit")).toBeUndefined();
  });
});

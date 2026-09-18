import { describe, expect, it } from "vitest";

import { mergeSteers, undeliveredSteerNotice } from "./steer-queue";

describe("mergeSteers", () => {
  it("keeps every queued message", () => {
    expect(mergeSteers(["first", "second"])).toBe("first\n\nsecond");
  });

  it("drops blank entries without dropping real ones", () => {
    expect(mergeSteers(["  ", "only"])).toBe("only");
  });

  it("is empty for an empty queue", () => {
    expect(mergeSteers([])).toBe("");
  });
});

describe("undeliveredSteerNotice", () => {
  it("says how many were lost and why", () => {
    expect(undeliveredSteerNotice(1, "the session was canceled.")).toBe(
      "1 message never reached the agent — the session was canceled. Send it again.",
    );
  });

  it("pluralises", () => {
    expect(undeliveredSteerNotice(2, "its worktree is gone.")).toBe(
      "2 messages never reached the agent — its worktree is gone. Send them again.",
    );
  });
});

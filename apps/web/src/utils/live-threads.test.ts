import { describe, expect, it } from "vitest";

import {
  groupByChannel,
  type LiveThreadItem,
  threadTitle,
} from "./live-threads";

const thread = (over: Partial<LiveThreadItem> = {}): LiveThreadItem => ({
  id: "t1",
  projectId: "p1",
  status: "running",
  rootText: "Ship the sidebar",
  lastProgress: null,
  startedAt: new Date("2026-09-19T10:00:00Z"),
  ...over,
});

describe("threadTitle", () => {
  it("takes the first line of the root message", () => {
    expect(threadTitle("Fix the dock\n\nIt drops frames on resize.")).toBe(
      "Fix the dock",
    );
  });

  it("trims the line it takes", () => {
    expect(threadTitle("   Fix the dock   \nmore")).toBe("Fix the dock");
  });

  it("falls back when the root message is empty or blank", () => {
    expect(threadTitle("")).toBe("Untitled");
    expect(threadTitle("   \nsomething")).toBe("Untitled");
  });
});

describe("groupByChannel", () => {
  it("buckets threads by the channel they run in", () => {
    const grouped = groupByChannel([
      thread({ id: "t1", projectId: "p1" }),
      thread({ id: "t2", projectId: "p2" }),
      thread({ id: "t3", projectId: "p1" }),
    ]);

    expect(grouped.get("p1")?.map((entry) => entry.id)).toEqual(["t1", "t3"]);
    expect(grouped.get("p2")?.map((entry) => entry.id)).toEqual(["t2"]);
  });

  it("keeps the order it was given inside each channel", () => {
    const grouped = groupByChannel([
      thread({ id: "newest", startedAt: new Date("2026-09-19T12:00:00Z") }),
      thread({ id: "oldest", startedAt: new Date("2026-09-19T08:00:00Z") }),
    ]);

    expect(grouped.get("p1")?.map((entry) => entry.id)).toEqual([
      "newest",
      "oldest",
    ]);
  });

  it("has no entry for a channel with nothing running", () => {
    const grouped = groupByChannel([thread({ projectId: "p1" })]);

    expect(grouped.get("p2")).toBeUndefined();
    expect(grouped.size).toBe(1);
  });

  it("returns an empty map for an empty list", () => {
    expect(groupByChannel([]).size).toBe(0);
  });
});

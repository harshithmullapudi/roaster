import { describe, expect, it } from "vitest";

import {
  countByState,
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

describe("countByState", () => {
  it("counts an agent working separately from one waiting on a person", () => {
    const counts = countByState([
      thread({ id: "a", status: "running" }),
      thread({ id: "b", status: "starting" }),
      thread({ id: "c", status: "needs_input" }),
    ]);

    expect(counts).toEqual({ running: 2, needsInput: 1 });
  });

  it("does not let a thread waiting on a person be counted as running", () => {
    const counts = countByState([thread({ status: "needs_input" })]);

    expect(counts.running).toBe(0);
    expect(counts.needsInput).toBe(1);
  });

  it("ignores states that are neither", () => {
    const counts = countByState([
      thread({ id: "a", status: "waiting" }),
      thread({ id: "b", status: "idle" }),
    ]);

    expect(counts).toEqual({ running: 0, needsInput: 0 });
  });
});

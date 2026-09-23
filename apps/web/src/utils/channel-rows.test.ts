import { describe, expect, it } from "vitest";

import {
  anchorRowIndex,
  bandLabel,
  buildChannelRows,
  type RowThread,
} from "./channel-rows";

type Mark = "completed" | "chatter" | "running" | "failed";

const THREADS: Record<
  Exclude<Mark, "chatter">,
  Omit<RowThread, "id">
> = {
  completed: {
    status: "completed",
    completedAt: new Date("2026-09-20T10:00:00.000Z"),
  },
  running: { status: "running", completedAt: null },
  failed: { status: "failed", completedAt: null },
};

function channel(marks: Mark[]) {
  const messages = marks.map((_, index) => ({
    id: `m${index}`,
    createdAt: new Date(2026, 8, 20, 10, index),
  }));
  const threads = new Map<string, RowThread>();

  marks.forEach((mark, index) => {
    if (mark === "chatter") return;
    threads.set(`m${index}`, { id: `t${index}`, ...THREADS[mark] });
  });

  return { messages, threads };
}

function rows(marks: Mark[], expanded: string[] = []) {
  const { messages, threads } = channel(marks);
  return buildChannelRows(messages, threads, {
    collapse: true,
    expanded: new Set(expanded),
  });
}

function shape(marks: Mark[], expanded: string[] = []) {
  return rows(marks, expanded).map((row) =>
    row.kind === "band" ? `band(${row.messageIds.length})` : row.message.id,
  );
}

describe("buildChannelRows", () => {
  it("folds a run of completed conversations into one band", () => {
    expect(shape(["completed", "completed", "completed"])).toEqual(["band(3)"]);
  });

  it("folds a lone completed conversation too, so the channel reads evenly", () => {
    expect(shape(["completed"])).toEqual(["band(1)"]);
  });

  it("keeps plain chatter out of the band and lets it split a run", () => {
    expect(
      shape(["completed", "completed", "chatter", "completed", "completed"]),
    ).toEqual(["band(2)", "m2", "band(2)"]);
  });

  it("leaves a live conversation alone and splits the run around it", () => {
    expect(shape(["completed", "running", "completed"])).toEqual([
      "band(1)",
      "m1",
      "band(1)",
    ]);
  });

  it("never folds a failed conversation away — it still wants attention", () => {
    expect(shape(["completed", "failed", "completed"])).toEqual([
      "band(1)",
      "m1",
      "band(1)",
    ]);
  });

  it("leaves every message in place when the reader turns collapsing off", () => {
    const { messages, threads } = channel([
      "completed",
      "completed",
      "chatter",
    ]);
    const built = buildChannelRows(messages, threads, {
      collapse: false,
      expanded: new Set(),
    });
    expect(built.map((row) => row.kind)).toEqual([
      "message",
      "message",
      "message",
    ]);
  });

  it("names a band after the first conversation in it, so paging cannot rename it", () => {
    const [band] = rows(["completed", "completed", "chatter"]);
    expect(band?.kind === "band" && band.id).toBe("m0");

    const [, afterOlderPageArrives] = rows([
      "chatter",
      "completed",
      "completed",
      "chatter",
    ]);
    expect(
      afterOlderPageArrives?.kind === "band" && afterOlderPageArrives.id,
    ).toBe("m1");
  });

  it("keeps the band above its conversations when a reader opens it", () => {
    expect(shape(["completed", "completed", "chatter"], ["m0"])).toEqual([
      "band(2)",
      "m0",
      "m1",
      "m2",
    ]);
  });

  it("only opens the band that was asked for", () => {
    expect(shape(["completed", "chatter", "completed"], ["m2"])).toEqual([
      "band(1)",
      "m1",
      "band(1)",
      "m2",
    ]);
  });

  it("carries the time of the last conversation it folded", () => {
    const [band] = rows(["completed", "completed"]);
    expect(band?.kind === "band" && band.lastAt).toEqual(
      new Date(2026, 8, 20, 10, 1),
    );
  });

  it("reports whether a band is open, so the row can point its chevron", () => {
    const [shut] = rows(["completed", "completed"]);
    const [open] = rows(["completed", "completed"], ["m0"]);
    expect(shut?.kind === "band" && shut.expanded).toBe(false);
    expect(open?.kind === "band" && open.expanded).toBe(true);
  });
});

describe("bandLabel", () => {
  it("counts one conversation without pluralising it", () => {
    expect(bandLabel(1)).toBe("1 completed conversation");
  });

  it("counts the rest", () => {
    expect(bandLabel(4)).toBe("4 completed conversations");
  });
});

describe("anchorRowIndex", () => {
  const paged: Mark[] = [
    "completed",
    "completed",
    "chatter",
    "completed",
    "completed",
  ];

  it("counts the rows sitting above the message the list is anchored to", () => {
    expect(anchorRowIndex(rows(paged), "m3")).toBe(2);
  });

  it("counts the band a folded anchor was swallowed by", () => {
    expect(anchorRowIndex(rows(paged), "m1")).toBe(0);
  });

  it("is nothing when the anchor has gone, so the list keeps what it had", () => {
    expect(anchorRowIndex(rows(paged), "deleted")).toBeNull();
  });
});

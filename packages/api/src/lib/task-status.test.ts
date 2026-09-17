import { describe, expect, it } from "vitest";

import { normalizeTaskStatus, TASK_STATUSES, TASK_STATUS_ORDER } from "./task-status";

describe("normalizeTaskStatus", () => {
  it("keeps the statuses we know", () => {
    expect(normalizeTaskStatus("todo")).toBe("todo");
    expect(normalizeTaskStatus("in_progress")).toBe("in_progress");
    expect(normalizeTaskStatus("done")).toBe("done");
  });

  it("falls back to todo for anything else", () => {
    expect(normalizeTaskStatus("archived")).toBe("todo");
    expect(normalizeTaskStatus("Todo")).toBe("todo");
    expect(normalizeTaskStatus("")).toBe("todo");
    expect(normalizeTaskStatus(null)).toBe("todo");
    expect(normalizeTaskStatus(undefined)).toBe("todo");
  });
});

describe("TASK_STATUS_ORDER", () => {
  it("covers every status exactly once", () => {
    expect([...TASK_STATUS_ORDER].sort()).toEqual([...TASK_STATUSES].sort());
  });

  it("puts done last so finished work sinks to the bottom", () => {
    expect(TASK_STATUS_ORDER.at(-1)).toBe("done");
  });
});

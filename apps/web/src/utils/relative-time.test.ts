import { describe, expect, it } from "vitest";

import { elapsedLabel } from "./relative-time";

function after(startedAt: Date, seconds: number): Date {
  return new Date(startedAt.getTime() + seconds * 1000);
}

describe("elapsedLabel", () => {
  const start = new Date("2026-09-23T12:00:00.000Z");

  it("counts seconds through the first minute", () => {
    expect(elapsedLabel(start, after(start, 0))).toBe("0s");
    expect(elapsedLabel(start, after(start, 9))).toBe("9s");
    expect(elapsedLabel(start, after(start, 59))).toBe("59s");
  });

  it("settles to whole minutes so ambient chrome stops ticking", () => {
    expect(elapsedLabel(start, after(start, 60))).toBe("1m");
    expect(elapsedLabel(start, after(start, 316))).toBe("5m");
    expect(elapsedLabel(start, after(start, 359))).toBe("5m");
  });

  it("keeps minutes alongside hours once past an hour", () => {
    expect(elapsedLabel(start, after(start, 3600))).toBe("1h 0m");
    expect(elapsedLabel(start, after(start, 7_500))).toBe("2h 5m");
  });

  it("never reports a negative span", () => {
    expect(elapsedLabel(start, after(start, -30))).toBe("0s");
  });
});

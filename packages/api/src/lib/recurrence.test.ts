import { describe, expect, it } from "vitest";

import {
  buildRecurrence,
  describeRecurrence,
  nextOccurrence,
  onceAt,
  parseRecurrence,
  RecurrenceError,
} from "./recurrence";

const NY = "America/New_York";

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

describe("parsing a rule", () => {
  it("accepts a rule with its own start", () => {
    expect(() =>
      parseRecurrence("DTSTART:20260106T090000\nRRULE:FREQ=WEEKLY;BYDAY=TU"),
    ).not.toThrow();
  });

  it("accepts a bare rule", () => {
    expect(() => parseRecurrence("FREQ=DAILY")).not.toThrow();
  });

  it("refuses a rule it cannot parse", () => {
    expect(() => parseRecurrence("FREQ=NEVER")).toThrow(RecurrenceError);
  });

  it("refuses an empty rule", () => {
    expect(() => parseRecurrence("   ")).toThrow(RecurrenceError);
  });
});

describe("describing a rule", () => {
  it("reads a fortnightly rule back in words", () => {
    expect(describeRecurrence("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU")).toBe(
      "every 2 weeks on Tuesday",
    );
  });

  it("reads a monthly rule back in words", () => {
    expect(describeRecurrence("FREQ=MONTHLY;BYDAY=-1FR")).toContain("month");
  });
});

describe("the next occurrence", () => {
  it("finds the next slot in UTC", () => {
    const next = nextOccurrence({
      rule: "DTSTART:20260106T090000\nRRULE:FREQ=DAILY",
      timezone: "UTC",
      after: new Date("2026-01-06T10:00:00Z"),
    });

    expect(iso(next)).toBe("2026-01-07T09:00:00.000Z");
  });

  it("expresses every other Tuesday, which cron cannot", () => {
    const rule = "DTSTART:20260106T090000\nRRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU";

    const first = nextOccurrence({
      rule,
      timezone: "UTC",
      after: new Date("2026-01-06T09:00:01Z"),
    });
    expect(iso(first)).toBe("2026-01-20T09:00:00.000Z");

    const second = nextOccurrence({
      rule,
      timezone: "UTC",
      after: first!,
    });
    expect(iso(second)).toBe("2026-02-03T09:00:00.000Z");
  });

  it("expresses the last Friday of the month", () => {
    const next = nextOccurrence({
      rule: "DTSTART:20260101T090000\nRRULE:FREQ=MONTHLY;BYDAY=-1FR",
      timezone: "UTC",
      after: new Date("2026-01-02T00:00:00Z"),
    });

    expect(iso(next)).toBe("2026-01-30T09:00:00.000Z");
  });

  it("returns null once a counted rule is exhausted", () => {
    const rule = "DTSTART:20260106T090000\nRRULE:FREQ=DAILY;COUNT=2";

    expect(
      iso(
        nextOccurrence({
          rule,
          timezone: "UTC",
          after: new Date("2026-01-07T09:00:01Z"),
        }),
      ),
    ).toBeNull();
  });

  it("returns null once an UNTIL rule is exhausted", () => {
    expect(
      iso(
        nextOccurrence({
          rule: "DTSTART:20260106T090000\nRRULE:FREQ=DAILY;UNTIL=20260108T000000Z",
          timezone: "UTC",
          after: new Date("2026-01-09T00:00:00Z"),
        }),
      ),
    ).toBeNull();
  });
});

describe("daylight saving", () => {
  const rule = "DTSTART:20260301T090000\nRRULE:FREQ=DAILY";

  it("holds 9am local across spring forward", () => {
    const before = nextOccurrence({
      rule,
      timezone: NY,
      after: new Date("2026-03-06T20:00:00Z"),
    });
    expect(iso(before)).toBe("2026-03-07T14:00:00.000Z");

    const after = nextOccurrence({ rule, timezone: NY, after: before! });
    expect(iso(after)).toBe("2026-03-08T13:00:00.000Z");

    expect(after!.getTime() - before!.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it("holds 9am local across fall back", () => {
    const before = nextOccurrence({
      rule,
      timezone: NY,
      after: new Date("2026-10-30T20:00:00Z"),
    });
    expect(iso(before)).toBe("2026-10-31T13:00:00.000Z");

    const after = nextOccurrence({ rule, timezone: NY, after: before! });
    expect(iso(after)).toBe("2026-11-01T14:00:00.000Z");

    expect(after!.getTime() - before!.getTime()).toBe(25 * 60 * 60 * 1000);
  });

  it("keeps a zone without daylight saving on a flat 24 hours", () => {
    const before = nextOccurrence({
      rule,
      timezone: "Asia/Kolkata",
      after: new Date("2026-03-06T20:00:00Z"),
    });
    const after = nextOccurrence({
      rule,
      timezone: "Asia/Kolkata",
      after: before!,
    });

    expect(iso(before)).toBe("2026-03-07T03:30:00.000Z");
    expect(after!.getTime() - before!.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("building a rule", () => {
  it("turns a datetime-local value into a one-shot", () => {
    expect(onceAt("2026-09-24T09:30")).toBe(
      "DTSTART:20260924T093000\nRRULE:FREQ=DAILY;COUNT=1",
    );
  });

  it("fires a one-shot exactly once, at its local time", () => {
    const rule = onceAt("2026-09-24T09:30");

    const first = nextOccurrence({
      rule,
      timezone: "Asia/Kolkata",
      after: new Date("2026-09-24T00:00:00Z"),
    });
    expect(first?.toISOString()).toBe("2026-09-24T04:00:00.000Z");

    expect(
      nextOccurrence({ rule, timezone: "Asia/Kolkata", after: first! }),
    ).toBeNull();
  });

  it("builds a fortnightly rule on chosen weekdays", () => {
    expect(
      buildRecurrence({
        startLocal: "2026-09-24T09:00",
        freq: "weekly",
        interval: 2,
        weekdays: ["TU", "TH"],
      }),
    ).toBe(
      "DTSTART:20260924T090000\nRRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH",
    );
  });

  it("leaves the interval out when it is one", () => {
    expect(
      buildRecurrence({
        startLocal: "2026-09-24T09:00",
        freq: "daily",
        interval: 1,
        weekdays: [],
      }),
    ).toBe("DTSTART:20260924T090000\nRRULE:FREQ=DAILY");
  });

  it("round-trips through the parser it will be stored for", () => {
    const rule = buildRecurrence({
      startLocal: "2026-09-24T09:00",
      freq: "weekly",
      interval: 2,
      weekdays: ["TU"],
    });

    expect(describeRecurrence(rule)).toBe("every 2 weeks on Tuesday");
  });

  it("refuses a datetime it cannot read", () => {
    expect(() => onceAt("tomorrow-ish")).toThrow(RecurrenceError);
  });
});

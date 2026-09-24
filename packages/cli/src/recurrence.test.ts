import { describe, expect, it } from "vitest";

import { withStart } from "./recurrence.js";

const NOON_UTC = new Date("2026-09-24T12:00:00Z");

describe("giving a rule a start", () => {
  it("anchors a bare rule to a time of day", () => {
    expect(
      withStart("FREQ=WEEKLY;BYDAY=TH", "17:00", "UTC", NOON_UTC),
    ).toBe("DTSTART:20260924T170000\nRRULE:FREQ=WEEKLY;BYDAY=TH");
  });

  it("uses the date in the zone the person named", () => {
    expect(
      withStart("FREQ=DAILY", "09:00", "Pacific/Kiritimati", NOON_UTC),
    ).toBe("DTSTART:20260925T090000\nRRULE:FREQ=DAILY");
  });

  it("falls back to the current wall clock when no time is given", () => {
    expect(withStart("FREQ=DAILY", undefined, "UTC", NOON_UTC)).toBe(
      "DTSTART:20260924T120000\nRRULE:FREQ=DAILY",
    );
  });

  it("strips a RRULE prefix the caller already typed", () => {
    expect(withStart("RRULE:FREQ=DAILY", "08:30", "UTC", NOON_UTC)).toBe(
      "DTSTART:20260924T083000\nRRULE:FREQ=DAILY",
    );
  });

  it("leaves a rule that already carries its own start alone", () => {
    const rule = "DTSTART:20260101T090000\nRRULE:FREQ=DAILY";
    expect(withStart(rule, undefined, "UTC", NOON_UTC)).toBe(rule);
  });

  it("refuses a time it cannot read", () => {
    expect(() => withStart("FREQ=DAILY", "5pm", "UTC", NOON_UTC)).toThrow(
      /--at/,
    );
  });

  it("refuses an hour that does not exist", () => {
    expect(() => withStart("FREQ=DAILY", "25:00", "UTC", NOON_UTC)).toThrow(
      /--at/,
    );
  });

  it("refuses --at when the rule already has a start", () => {
    const rule = "DTSTART:20260101T090000\nRRULE:FREQ=DAILY";
    expect(() => withStart(rule, "17:00", "UTC", NOON_UTC)).toThrow(/DTSTART/);
  });
});

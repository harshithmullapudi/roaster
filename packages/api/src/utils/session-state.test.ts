import { describe, expect, it } from "vitest";

import { type LifecycleEvent, nextStatus } from "./session-state";

const EVENTS: LifecycleEvent[] = [
  "Start",
  "Stop",
  "Detached",
  "PermissionRequest",
  "Failed",
];

describe("nextStatus", () => {
  it("parks a session at idle when the agent stops", () => {
    expect(
      nextStatus({
        current: "running",
        event: "Stop",
        answersDelegation: false,
      }),
    ).toBe("idle");
  });

  it("completes a session that owes another thread an answer", () => {
    expect(
      nextStatus({ current: "running", event: "Stop", answersDelegation: true }),
    ).toBe("completed");
  });

  it("treats Detached like Stop", () => {
    expect(
      nextStatus({
        current: "running",
        event: "Detached",
        answersDelegation: false,
      }),
    ).toBe("idle");
    expect(
      nextStatus({
        current: "running",
        event: "Detached",
        answersDelegation: true,
      }),
    ).toBe("completed");
  });

  it("asks for a person when the agent raises a permission request", () => {
    expect(
      nextStatus({
        current: "running",
        event: "PermissionRequest",
        answersDelegation: false,
      }),
    ).toBe("needs_input");
  });

  it("wakes an idle session when the agent starts again", () => {
    expect(
      nextStatus({ current: "idle", event: "Start", answersDelegation: false }),
    ).toBe("running");
  });

  it("clears needs_input once the agent starts working again", () => {
    expect(
      nextStatus({
        current: "needs_input",
        event: "Start",
        answersDelegation: false,
      }),
    ).toBe("running");
  });

  it("fails a session when the agent reports a failure", () => {
    expect(
      nextStatus({
        current: "running",
        event: "Failed",
        answersDelegation: false,
      }),
    ).toBe("failed");
  });

  it.each(["completed", "failed", "canceled"])(
    "ignores late events once a session has ended (%s)",
    (current) => {
      for (const event of EVENTS) {
        expect(
          nextStatus({ current, event, answersDelegation: false }),
        ).toBeNull();
      }
    },
  );

  it("leaves a session parked on a delegate alone", () => {
    for (const event of EVENTS) {
      expect(
        nextStatus({ current: "waiting", event, answersDelegation: false }),
      ).toBeNull();
    }
  });

  it("reports no change when the status already matches", () => {
    expect(
      nextStatus({
        current: "running",
        event: "Start",
        answersDelegation: false,
      }),
    ).toBeNull();
    expect(
      nextStatus({
        current: "needs_input",
        event: "PermissionRequest",
        answersDelegation: false,
      }),
    ).toBeNull();
    expect(
      nextStatus({ current: "idle", event: "Stop", answersDelegation: false }),
    ).toBeNull();
  });
});

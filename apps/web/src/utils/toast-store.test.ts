import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_TOASTS,
  readToasts,
  resetToasts,
  subscribeToasts,
  toast,
} from "./toast-store";

describe("toast-store", () => {
  beforeEach(() => {
    resetToasts();
  });

  it("starts empty", () => {
    expect(readToasts()).toEqual([]);
  });

  it("holds a loading toast open", () => {
    toast.loading("Completing thread…");

    const [note] = readToasts();
    expect(note?.tone).toBe("loading");
    expect(note?.title).toBe("Completing thread…");
    expect(note?.duration).toBe(Number.POSITIVE_INFINITY);
  });

  it("turns a loading toast into a success in place", () => {
    const first = toast.loading("first");
    toast.loading("second");

    first.success("Thread completed");

    const notes = readToasts();
    expect(notes.map((note) => note.title)).toEqual([
      "Thread completed",
      "second",
    ]);
    expect(notes[0]?.id).toBe(first.id);
    expect(notes[0]?.tone).toBe("success");
    expect(notes[0]?.duration).toBeLessThan(Number.POSITIVE_INFINITY);
  });

  it("carries a reason on the error toast", () => {
    const note = toast.loading("Completing thread…");

    note.error("Could not complete that thread", "The agent is still running.");

    expect(readToasts()[0]).toMatchObject({
      tone: "error",
      title: "Could not complete that thread",
      description: "The agent is still running.",
    });
  });

  it("keeps an error up longer than a success", () => {
    toast.success("done");
    toast.error("broke");

    const [success, error] = readToasts();
    expect(error?.duration).toBeGreaterThan(success?.duration ?? 0);
  });

  it("drops a dismissed toast", () => {
    const note = toast.loading("Completing thread…");

    note.dismiss();

    expect(readToasts()).toEqual([]);
  });

  it("brings the outcome back after the loading toast was dismissed", () => {
    const note = toast.loading("Completing thread…");
    note.dismiss();

    note.success("Thread completed");

    expect(readToasts().map((entry) => entry.title)).toEqual([
      "Thread completed",
    ]);
  });

  it("drops the oldest once the stack is full", () => {
    for (let index = 0; index <= MAX_TOASTS; index += 1) {
      toast.success(`note ${index}`);
    }

    const notes = readToasts();
    expect(notes).toHaveLength(MAX_TOASTS);
    expect(notes[0]?.title).toBe("note 1");
  });

  it("notifies subscribers until they unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToasts(listener);

    const note = toast.loading("Completing thread…");
    note.success("Thread completed");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    toast.error("broke");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("hands back the same array until something changes", () => {
    const before = readToasts();
    expect(readToasts()).toBe(before);

    toast.success("done");
    expect(readToasts()).not.toBe(before);
  });
});

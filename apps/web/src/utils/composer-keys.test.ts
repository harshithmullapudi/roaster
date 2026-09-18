import { describe, expect, it } from "vitest";

import { submitsOnEnter } from "./composer-keys";

const enter = { key: "Enter", shiftKey: false, isComposing: false, keyCode: 13 };
const desktop = { suggestionOpen: false, touchKeyboard: false };

describe("submitsOnEnter", () => {
  it("sends on a bare Enter", () => {
    expect(submitsOnEnter(enter, desktop)).toBe(true);
  });

  it("leaves the mention popup its Enter", () => {
    expect(
      submitsOnEnter(enter, { ...desktop, suggestionOpen: true }),
    ).toBe(false);
  });

  it("ignores keys that are not Enter", () => {
    expect(submitsOnEnter({ ...enter, key: "a" }, desktop)).toBe(false);
  });

  it("lets Shift+Enter break the line", () => {
    expect(submitsOnEnter({ ...enter, shiftKey: true }, desktop)).toBe(false);
  });

  it("stays out of an IME composition", () => {
    expect(submitsOnEnter({ ...enter, isComposing: true }, desktop)).toBe(
      false,
    );
    expect(submitsOnEnter({ ...enter, keyCode: 229 }, desktop)).toBe(false);
  });

  it("keeps Enter as a newline on a touch keyboard", () => {
    expect(submitsOnEnter(enter, { ...desktop, touchKeyboard: true })).toBe(
      false,
    );
  });
});

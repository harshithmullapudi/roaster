import { describe, expect, it } from "vitest";

import { firesWhileTyping } from "~/utils/shortcut-keys";

describe("firesWhileTyping", () => {
  it("lets a command shortcut through a focused field", () => {
    expect(firesWhileTyping("$mod+k")).toBe(true);
    expect(firesWhileTyping("Meta+k")).toBe(true);
    expect(firesWhileTyping("Control+Shift+p")).toBe(true);
  });

  it("holds back shortcuts a person could type", () => {
    expect(firesWhileTyping("k")).toBe(false);
    expect(firesWhileTyping("Shift+d")).toBe(false);
    expect(firesWhileTyping("Alt+n")).toBe(false);
  });

  it("holds back a sequence with a typeable press in it", () => {
    expect(firesWhileTyping("g i")).toBe(false);
    expect(firesWhileTyping("$mod+k j")).toBe(false);
  });

  it("treats an optional modifier as no modifier at all", () => {
    expect(firesWhileTyping("[Meta]+k")).toBe(false);
  });
});

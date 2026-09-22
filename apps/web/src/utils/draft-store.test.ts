import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearDraft,
  draftKey,
  isEmptyDoc,
  readDraft,
  writeDraft,
} from "./draft-store";

function paragraph(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("draftKey", () => {
  it("keeps two channels apart", () => {
    expect(draftKey({ projectId: "a" })).not.toBe(draftKey({ projectId: "b" }));
  });

  it("keeps a thread reply apart from its channel", () => {
    expect(draftKey({ projectId: "a", threadId: "t1" })).not.toBe(
      draftKey({ projectId: "a" }),
    );
  });

  it("keeps two threads apart", () => {
    expect(draftKey({ projectId: "a", threadId: "t1" })).not.toBe(
      draftKey({ projectId: "a", threadId: "t2" }),
    );
  });
});

describe("isEmptyDoc", () => {
  it("calls a fresh editor empty", () => {
    expect(isEmptyDoc(EMPTY_DOC)).toBe(true);
  });

  it("calls whitespace empty", () => {
    expect(isEmptyDoc(paragraph("   "))).toBe(true);
  });

  it("does not call typed text empty", () => {
    expect(isEmptyDoc(paragraph("hi"))).toBe(false);
  });

  it("does not call a mention-only draft empty", () => {
    expect(
      isEmptyDoc({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "mention", attrs: { id: "1", label: "ash" } }],
          },
        ],
      }),
    ).toBe(false);
  });
});

describe("writeDraft / readDraft", () => {
  it("reads back what was written", () => {
    const key = draftKey({ projectId: "a" });
    writeDraft(key, paragraph("half a thought"));
    expect(readDraft(key)).toEqual(paragraph("half a thought"));
  });

  it("returns null when nothing was written", () => {
    expect(readDraft(draftKey({ projectId: "nope" }))).toBeNull();
  });

  it("does not persist an empty editor", () => {
    const key = draftKey({ projectId: "a" });
    writeDraft(key, EMPTY_DOC);
    expect(readDraft(key)).toBeNull();
  });

  it("drops a stored draft once the editor is emptied again", () => {
    const key = draftKey({ projectId: "a" });
    writeDraft(key, paragraph("typed"));
    writeDraft(key, EMPTY_DOC);
    expect(readDraft(key)).toBeNull();
  });

  it("clears on send", () => {
    const key = draftKey({ projectId: "a" });
    writeDraft(key, paragraph("sent"));
    clearDraft(key);
    expect(readDraft(key)).toBeNull();
  });

  it("survives corrupt storage without throwing", () => {
    const key = draftKey({ projectId: "a" });
    localStorage.setItem(key, "{not json");
    expect(readDraft(key)).toBeNull();
  });
});

describe("without storage", () => {
  it("degrades quietly when localStorage is missing", () => {
    Reflect.deleteProperty(globalThis, "localStorage");
    const key = draftKey({ projectId: "a" });

    expect(() => writeDraft(key, paragraph("hi"))).not.toThrow();
    expect(readDraft(key)).toBeNull();
    expect(() => clearDraft(key)).not.toThrow();
  });
});

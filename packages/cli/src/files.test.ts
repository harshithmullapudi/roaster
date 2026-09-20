import { describe, expect, it } from "vitest";

import {
  attachmentIdFrom,
  downloadTarget,
  filenameFromDisposition,
} from "./files";

const ID = "3f042ad5-1a9a-4f80-868d-b03776c73a07";

describe("attachmentIdFrom", () => {
  it("takes the URL an agent read out of the message", () => {
    expect(attachmentIdFrom(`https://roster.example.com/api/files/${ID}`)).toBe(ID);
    expect(attachmentIdFrom(`https://roster.example.com/api/files/${ID}?download`)).toBe(
      ID,
    );
  });

  it("takes a bare id", () => {
    expect(attachmentIdFrom(ID)).toBe(ID);
    expect(attachmentIdFrom(`  ${ID}  `)).toBe(ID);
  });

  it("refuses anything that is not one", () => {
    expect(attachmentIdFrom("https://roster.example.com/demo/design")).toBeNull();
    expect(attachmentIdFrom("../../etc/passwd")).toBeNull();
    expect(attachmentIdFrom("")).toBeNull();
  });
});

describe("filenameFromDisposition", () => {
  it("reads the encoded form Roster sends", () => {
    expect(
      filenameFromDisposition("attachment; filename*=UTF-8''Screenshot%202026.png"),
    ).toBe("Screenshot 2026.png");
  });

  it("reads a plain one too", () => {
    expect(filenameFromDisposition('attachment; filename="notes.pdf"')).toBe(
      "notes.pdf",
    );
    expect(filenameFromDisposition("inline; filename=chart.png")).toBe("chart.png");
  });

  it("never returns a path", () => {
    expect(
      filenameFromDisposition("attachment; filename*=UTF-8''..%2F..%2Fetc%2Fpasswd"),
    ).toBe("passwd");
  });

  it("is null when the header says nothing useful", () => {
    expect(filenameFromDisposition(null)).toBeNull();
    expect(filenameFromDisposition("attachment")).toBeNull();
  });
});

describe("downloadTarget", () => {
  const never = () => false;
  const always = () => true;

  it("uses the server's name in the working directory by default", () => {
    const target = downloadTarget({ filename: "mock.png", isDirectory: never });
    expect(target.endsWith("/mock.png")).toBe(true);
  });

  it("writes into --out when it names a directory", () => {
    const target = downloadTarget({
      out: "/tmp/inbox",
      filename: "mock.png",
      isDirectory: always,
    });
    expect(target).toBe("/tmp/inbox/mock.png");
  });

  it("uses --out as the filename when it is not a directory", () => {
    const target = downloadTarget({
      out: "/tmp/renamed.png",
      filename: "mock.png",
      isDirectory: never,
    });
    expect(target).toBe("/tmp/renamed.png");
  });

  it("falls back to a name when the server gave none", () => {
    const target = downloadTarget({ filename: "", isDirectory: never });
    expect(target.endsWith("/attachment")).toBe(true);
  });
});

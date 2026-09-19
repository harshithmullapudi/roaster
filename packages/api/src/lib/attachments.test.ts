import { describe, expect, it } from "vitest";

import {
  attachmentRefusal,
  imageSize,
  isSafeStorageKey,
  MAX_ATTACHMENT_BYTES,
  sanitizeFilename,
  sniffMimeType,
  storageKeyFor,
} from "./attachments";

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function padded(head: number[], length: number): Uint8Array {
  const out = new Uint8Array(length);
  out.set(head);
  return out;
}

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function png(width: number, height: number): Uint8Array {
  const out = padded(PNG_HEADER, 32);
  const data = new DataView(out.buffer);
  data.setUint32(16, width);
  data.setUint32(20, height);
  return out;
}

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

describe("sniffMimeType", () => {
  it("reads each supported signature", () => {
    expect(sniffMimeType(bytes(...PNG_HEADER))).toBe("image/png");
    expect(sniffMimeType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMimeType(bytes(...ascii("GIF89a")))).toBe("image/gif");
    expect(sniffMimeType(bytes(...ascii("%PDF-1.7")))).toBe("application/pdf");

    const webp = padded([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")], 12);
    expect(sniffMimeType(webp)).toBe("image/webp");
  });

  it("does not take the client's word for it", () => {
    // An HTML file uploaded as image/png. Trusting the declared type would
    // store it and serve it back inline.
    expect(sniffMimeType(bytes(...ascii("<html><script>")))).toBeNull();
    expect(sniffMimeType(bytes(...ascii("<svg xmlns=")))).toBeNull();
  });

  it("is not fooled by a truncated signature", () => {
    expect(sniffMimeType(bytes(0x89, 0x50))).toBeNull();
    expect(sniffMimeType(bytes(...ascii("RIFF")))).toBeNull();
  });
});

describe("attachmentRefusal", () => {
  it("accepts a supported file", () => {
    expect(attachmentRefusal(png(10, 10))).toBeNull();
  });

  it("refuses an empty file", () => {
    expect(attachmentRefusal(new Uint8Array(0))).toBe("empty");
  });

  it("refuses a file over the size limit before sniffing it", () => {
    const huge = padded(PNG_HEADER, MAX_ATTACHMENT_BYTES + 1);
    expect(attachmentRefusal(huge)).toBe("too-large");
  });

  it("refuses an unsupported type", () => {
    expect(attachmentRefusal(bytes(...ascii("plain text")))).toBe(
      "unsupported-type",
    );
  });
});

describe("imageSize", () => {
  it("reads png dimensions", () => {
    expect(imageSize(png(1920, 1080))).toEqual({ width: 1920, height: 1080 });
  });

  it("reads gif dimensions", () => {
    const gif = padded([...ascii("GIF89a"), 0x20, 0x00, 0x10, 0x00], 10);
    expect(imageSize(gif)).toEqual({ width: 32, height: 16 });
  });

  it("reads jpeg dimensions across a leading segment", () => {
    const jpeg = padded(
      [
        0xff, 0xd8,
        // APP0, length 4, two bytes of payload — skipped to reach the frame.
        0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
        // SOF0: length, precision, height 0x0064, width 0x00c8.
        0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0xc8,
      ],
      32,
    );
    expect(imageSize(jpeg)).toEqual({ width: 200, height: 100 });
  });

  it("has no dimensions for a pdf", () => {
    expect(imageSize(bytes(...ascii("%PDF-1.4")))).toBeNull();
  });
});

describe("sanitizeFilename", () => {
  it("keeps an ordinary name", () => {
    expect(sanitizeFilename("Screenshot 2026-09-19.png")).toBe(
      "Screenshot 2026-09-19.png",
    );
  });

  it("drops any path it is given", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\me\\report.pdf")).toBe("report.pdf");
  });

  it("falls back when nothing usable is left", () => {
    expect(sanitizeFilename("   ")).toBe("file");
    expect(sanitizeFilename("..")).toBe("file");
  });

  it("caps the length", () => {
    expect(sanitizeFilename("a".repeat(500))).toHaveLength(200);
  });
});

describe("storage keys", () => {
  it("names a file by id, never by the name it was uploaded under", () => {
    const key = storageKeyFor({
      organizationId: "org-1",
      attachmentId: "att-1",
      mimeType: "image/jpeg",
    });
    expect(key).toBe("org-1/att-1.jpg");
    expect(isSafeStorageKey(key)).toBe(true);
  });

  it("rejects a key that would climb out of the uploads root", () => {
    expect(isSafeStorageKey("../../secrets")).toBe(false);
    expect(isSafeStorageKey("/etc/passwd")).toBe(false);
    expect(isSafeStorageKey("org/../../etc")).toBe(false);
    expect(isSafeStorageKey("")).toBe(false);
  });
});

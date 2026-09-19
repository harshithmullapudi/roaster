/**
 * What may be attached to a message, decided from the bytes rather than from
 * anything the browser said about them. A client-declared content type is a
 * claim: `image/png` on a file that is really HTML would be stored, served
 * back with that type, and rendered — so the declared type is discarded and
 * the stored one comes from the signature below.
 */

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

/** Mime type to the extension the file is stored under. */
export const ATTACHMENT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export type AttachmentRefusal = "empty" | "too-large" | "unsupported-type";

export const ATTACHMENT_REFUSALS: Record<AttachmentRefusal, string> = {
  empty: "That file is empty.",
  "too-large": "Files are limited to 10 MB.",
  "unsupported-type": "Only images (PNG, JPEG, GIF, WebP) and PDFs can be attached.",
};

export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith("image/") && mimeType in ATTACHMENT_TYPES;
}

export function extensionFor(mimeType: string): string {
  return ATTACHMENT_TYPES[mimeType] ?? "bin";
}

export function storageKeyFor(args: {
  organizationId: string;
  attachmentId: string;
  mimeType: string;
}): string {
  return `${args.organizationId}/${args.attachmentId}.${extensionFor(args.mimeType)}`;
}

/**
 * A stored key is only ever read back from the database, but it still names a
 * path on disk — so a row that somehow holds `../` must not escape the uploads
 * root when it is joined to it.
 */
export function isSafeStorageKey(key: string): boolean {
  if (key.length === 0 || key.startsWith("/")) return false;
  return key.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

/**
 * A filename is shown and offered as a download name, never used as a path.
 * Directory separators and control characters are stripped anyway: they make
 * a download name that a browser or an operating system reads oddly.
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f;
    })
    .join("")
    .trim();
  if (cleaned.length === 0 || cleaned === "." || cleaned === "..") return "file";
  return cleaned.slice(0, 200);
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/** The mime type the bytes actually are, or null for anything unsupported. */
export function sniffMimeType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

export function attachmentRefusal(bytes: Uint8Array): AttachmentRefusal | null {
  if (bytes.length === 0) return "empty";
  if (bytes.length > MAX_ATTACHMENT_BYTES) return "too-large";
  if (!sniffMimeType(bytes)) return "unsupported-type";
  return null;
}

export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Pixel dimensions, read from the header. Stored so a thumbnail can reserve
 * its space before the image loads — a message list that reflows as images
 * arrive scrolls out from under whoever is reading it.
 */
export function imageSize(bytes: Uint8Array): ImageSize | null {
  const type = sniffMimeType(bytes);
  if (type === "image/png") return pngSize(bytes);
  if (type === "image/gif") return gifSize(bytes);
  if (type === "image/jpeg") return jpegSize(bytes);
  if (type === "image/webp") return webpSize(bytes);
  return null;
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function pngSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 24) return null;
  const data = view(bytes);
  return { width: data.getUint32(16), height: data.getUint32(20) };
}

function gifSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 10) return null;
  const data = view(bytes);
  return { width: data.getUint16(6, true), height: data.getUint16(8, true) };
}

/** Walks the segment chain to the frame header, which carries the size. */
function jpegSize(bytes: Uint8Array): ImageSize | null {
  const data = view(bytes);
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;

    const marker = bytes[offset + 1] ?? 0;
    // Start-of-frame, minus the four markers in that range that are not one.
    const isFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc, 0xd8].includes(marker);
    if (isFrame) {
      return {
        height: data.getUint16(offset + 5),
        width: data.getUint16(offset + 7),
      };
    }

    const length = data.getUint16(offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }

  return null;
}

function webpSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 30) return null;
  const data = view(bytes);
  const format = ascii(bytes, 12, 4);

  if (format === "VP8 ") {
    return {
      width: data.getUint16(26, true) & 0x3fff,
      height: data.getUint16(28, true) & 0x3fff,
    };
  }

  if (format === "VP8L") {
    const bits = data.getUint32(21, true);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  if (format === "VP8X") {
    const at = (index: number) => bytes[index] ?? 0;
    const width = at(24) | (at(25) << 8) | (at(26) << 16);
    const height = at(27) | (at(28) << 8) | (at(29) << 16);
    return { width: width + 1, height: height + 1 };
  }

  return null;
}

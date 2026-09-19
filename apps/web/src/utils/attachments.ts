import {
  ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "@roster/api/attachments";

export { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE };

/** What the file picker offers. The server still decides from the bytes. */
export const ACCEPT_ATTRIBUTE = Object.keys(ATTACHMENT_TYPES).join(",");

export function isSupportedFile(file: File): boolean {
  if (file.type in ATTACHMENT_TYPES) return true;

  /**
   * A file dragged from some desktops arrives with an empty type. Falling
   * back to the extension keeps those droppable; a wrong guess costs one
   * refused upload, since the server reads the bytes either way.
   */
  if (file.type === "") {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    return Object.values(ATTACHMENT_TYPES).includes(
      extension === "jpeg" ? "jpg" : extension,
    );
  }

  return false;
}

/**
 * The files in a paste or a drop. `items` is read as well as `files` because
 * a screenshot pasted from the clipboard is an item of kind "file" and, in
 * some browsers, is not listed in `files` at all.
 */
export function filesFromTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];

  const found = new Map<string, File>();
  const add = (file: File | null) => {
    if (!file) return;
    found.set(`${file.name}:${file.size}:${file.lastModified}`, file);
  };

  for (const file of Array.from(data.files ?? [])) add(file);
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file") add(item.getAsFile());
  }

  return Array.from(found.values());
}

/**
 * Whether a drag is carrying files. A drag of selected text also fires the
 * drag events, and hanging a drop overlay on that would cover the composer
 * every time someone moved a word around.
 */
export function transferHasFiles(data: DataTransfer | null): boolean {
  if (!data) return false;
  return Array.from(data.types ?? []).includes("Files");
}

export type AttachmentKind = "image" | "pdf";

export function attachmentKind(mimeType: string): AttachmentKind {
  return mimeType.startsWith("image/") ? "image" : "pdf";
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export interface Box {
  width: number;
  height: number;
}

/**
 * The space a thumbnail takes. Sized from the stored dimensions so the row
 * reserves its height before the image loads — otherwise every image that
 * arrives shoves the conversation the reader is looking at down the page.
 */
export function thumbnailBox(
  size: { width: number | null; height: number | null },
  limit: Box = { width: 360, height: 280 },
): Box {
  if (!size.width || !size.height) return limit;

  const scale = Math.min(limit.width / size.width, limit.height / size.height, 1);
  return {
    width: Math.round(size.width * scale),
    height: Math.round(size.height * scale),
  };
}

export type LocalRefusal = "too-large" | "unsupported-type" | "too-many";

export const LOCAL_REFUSALS: Record<LocalRefusal, string> = {
  "too-large": "Files are limited to 10 MB.",
  "unsupported-type": "Only images and PDFs can be attached.",
  "too-many": `Up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`,
};

/**
 * Splits a batch into what can be uploaded and why the rest cannot. Checked
 * here as well as on the server so an oversized file is refused before it is
 * sent over the wire, not after.
 */
export function triageFiles(
  files: File[],
  alreadyAttached: number,
): { accepted: File[]; refusals: LocalRefusal[] } {
  const accepted: File[] = [];
  const refusals = new Set<LocalRefusal>();
  let room = MAX_ATTACHMENTS_PER_MESSAGE - alreadyAttached;

  for (const file of files) {
    if (!isSupportedFile(file)) {
      refusals.add("unsupported-type");
      continue;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      refusals.add("too-large");
      continue;
    }
    if (room <= 0) {
      refusals.add("too-many");
      continue;
    }
    room -= 1;
    accepted.push(file);
  }

  return { accepted, refusals: Array.from(refusals) };
}

import { describe, expect, it } from "vitest";

import {
  filesFromTransfer,
  formatBytes,
  isSupportedFile,
  thumbnailBox,
  transferHasFiles,
  triageFiles,
} from "./attachments";

function file(name: string, type: string, size = 10): File {
  return new File([new Uint8Array(size)], name, { type });
}

function transfer(args: {
  files?: File[];
  items?: File[];
  types?: string[];
}): DataTransfer {
  return {
    files: args.files ?? [],
    items: (args.items ?? []).map((entry) => ({
      kind: "file" as const,
      getAsFile: () => entry,
    })),
    types: args.types ?? (args.files?.length || args.items?.length ? ["Files"] : []),
  } as unknown as DataTransfer;
}

describe("isSupportedFile", () => {
  it("takes images and pdfs", () => {
    expect(isSupportedFile(file("a.png", "image/png"))).toBe(true);
    expect(isSupportedFile(file("a.pdf", "application/pdf"))).toBe(true);
  });

  it("refuses everything else", () => {
    expect(isSupportedFile(file("a.zip", "application/zip"))).toBe(false);
    expect(isSupportedFile(file("a.svg", "image/svg+xml"))).toBe(false);
  });

  it("falls back to the extension when the drag carries no type", () => {
    expect(isSupportedFile(file("photo.JPEG", ""))).toBe(true);
    expect(isSupportedFile(file("notes.txt", ""))).toBe(false);
  });
});

describe("filesFromTransfer", () => {
  it("reads a pasted screenshot listed only as an item", () => {
    const shot = file("image.png", "image/png");
    expect(filesFromTransfer(transfer({ items: [shot] }))).toEqual([shot]);
  });

  it("does not count a file listed in both places twice", () => {
    const dropped = file("a.png", "image/png");
    expect(
      filesFromTransfer(transfer({ files: [dropped], items: [dropped] })),
    ).toHaveLength(1);
  });

  it("is empty for a paste of plain text", () => {
    expect(filesFromTransfer(transfer({ types: ["text/plain"] }))).toEqual([]);
    expect(filesFromTransfer(null)).toEqual([]);
  });
});

describe("transferHasFiles", () => {
  it("is true only for a drag carrying files", () => {
    expect(transferHasFiles(transfer({ types: ["Files"] }))).toBe(true);
    expect(transferHasFiles(transfer({ types: ["text/plain"] }))).toBe(false);
  });
});

describe("triageFiles", () => {
  it("separates what can be uploaded from why the rest cannot", () => {
    const result = triageFiles(
      [
        file("ok.png", "image/png"),
        file("big.png", "image/png", 11 * 1024 * 1024),
        file("no.zip", "application/zip"),
      ],
      0,
    );

    expect(result.accepted.map((entry) => entry.name)).toEqual(["ok.png"]);
    expect(result.refusals.sort()).toEqual(["too-large", "unsupported-type"]);
  });

  it("counts the files already in the tray against the limit", () => {
    const batch = Array.from({ length: 4 }, (_, index) =>
      file(`${index}.png`, "image/png"),
    );

    const result = triageFiles(batch, 8);
    expect(result.accepted).toHaveLength(2);
    expect(result.refusals).toContain("too-many");
  });
});

describe("thumbnailBox", () => {
  it("scales a large image down to a thumbnail, not an embed", () => {
    expect(thumbnailBox({ width: 2000, height: 1000 })).toEqual({
      width: 200,
      height: 100,
    });
  });

  it("caps a tall image by its height", () => {
    expect(thumbnailBox({ width: 600, height: 1200 })).toEqual({
      width: 75,
      height: 150,
    });
  });

  it("leaves a small image alone", () => {
    expect(thumbnailBox({ width: 120, height: 90 })).toEqual({
      width: 120,
      height: 90,
    });
  });

  it("falls back to the limit when the size was never read", () => {
    expect(thumbnailBox({ width: null, height: null })).toEqual({
      width: 200,
      height: 150,
    });
  });
});

describe("formatBytes", () => {
  it("reads at the scale of the file", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

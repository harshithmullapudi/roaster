"use client";

import type { MessageAttachment } from "@roster/api";
import { Download, FileText } from "lucide-react";
import { useState } from "react";

import { attachmentKind, formatBytes, thumbnailBox } from "~/utils/attachments";

import { AttachmentPreview } from "./attachment-preview";

export interface MessageAttachmentsProps {
  attachments: MessageAttachment[];
}

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  const [previewing, setPreviewing] = useState<MessageAttachment | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="mt-1 flex flex-wrap items-start gap-2">
        {attachments.map((attachment) =>
          attachmentKind(attachment.mimeType) === "image" ? (
            <ImageThumbnail
              key={attachment.id}
              attachment={attachment}
              onOpen={() => setPreviewing(attachment)}
            />
          ) : (
            <FileCard
              key={attachment.id}
              attachment={attachment}
              onOpen={() => setPreviewing(attachment)}
            />
          ),
        )}
      </div>

      <AttachmentPreview
        attachment={previewing}
        onClose={() => setPreviewing(null)}
      />
    </>
  );
}

function ImageThumbnail({
  attachment,
  onOpen,
}: {
  attachment: MessageAttachment;
  onOpen: () => void;
}) {
  const box = thumbnailBox(attachment);

  return (
    <button
      type="button"
      onClick={onOpen}
      title={attachment.filename}
      className="border-border hover:border-primary block cursor-zoom-in overflow-hidden rounded-lg border transition-colors"
      style={{ maxWidth: "100%" }}
    >
      <img
        src={attachment.url}
        alt={attachment.filename}
        width={box.width}
        height={box.height}
        loading="lazy"
        className="block h-auto max-w-full object-cover"
        style={{ width: box.width, aspectRatio: `${box.width} / ${box.height}` }}
      />
    </button>
  );
}

function FileCard({
  attachment,
  onOpen,
}: {
  attachment: MessageAttachment;
  onOpen: () => void;
}) {
  return (
    <div className="bg-background-2 border-border flex max-w-xs items-center gap-2.5 rounded-lg border p-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <span className="bg-grayAlpha-100 text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded">
          <FileText size={16} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-foreground truncate text-sm">
            {attachment.filename}
          </span>
          <span className="text-muted-foreground text-xs">
            PDF · {formatBytes(attachment.size)}
          </span>
        </span>
      </button>

      <a
        href={`${attachment.url}?download`}
        download={attachment.filename}
        aria-label={`Download ${attachment.filename}`}
        title="Download"
        className="text-muted-foreground hover:text-foreground hover:bg-grayAlpha-100 flex h-7 w-7 shrink-0 items-center justify-center rounded"
      >
        <Download size={14} />
      </a>
    </div>
  );
}

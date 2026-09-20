"use client";

import type { MessageAttachment } from "@roster/api";
import { Dialog, DialogContent, DialogTitle } from "@roster/ui";
import { Download } from "lucide-react";

import { attachmentKind, formatBytes } from "~/utils/attachments";

export interface AttachmentPreviewProps {
  attachment: MessageAttachment | null;
  onClose: () => void;
}

export function AttachmentPreview({
  attachment,
  onClose,
}: AttachmentPreviewProps) {
  const isImage = attachment
    ? attachmentKind(attachment.mimeType) === "image"
    : false;

  return (
    <Dialog open={attachment !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[88vh] w-auto max-w-[min(1100px,calc(100vw-3rem))] flex-col gap-3 md:min-w-0">
        {attachment ? (
          <>
            <div className="flex items-center gap-3 pr-8">
              <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium">
                {attachment.filename}
              </DialogTitle>
              <span className="text-muted-foreground shrink-0 text-xs">
                {formatBytes(attachment.size)}
              </span>
              <a
                href={`${attachment.url}?download`}
                download={attachment.filename}
                title="Download"
                aria-label={`Download ${attachment.filename}`}
                className="text-muted-foreground hover:text-foreground hover:bg-grayAlpha-100 flex h-7 w-7 shrink-0 items-center justify-center rounded"
              >
                <Download size={14} />
              </a>
            </div>

            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachment.url}
                alt={attachment.filename}
                className="max-h-[76vh] min-h-40 w-auto max-w-full self-center rounded object-contain"
              />
            ) : (
              <iframe
                src={attachment.url}
                title={attachment.filename}
                className="bg-background-3 h-[76vh] w-[min(900px,80vw)] rounded border-0"
              />
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

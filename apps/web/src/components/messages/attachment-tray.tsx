"use client";

import { cn } from "@roster/ui";
import { FileText, X } from "lucide-react";

import type { PendingAttachment } from "~/hooks/use-attachments";
import { formatBytes } from "~/utils/attachments";

export interface AttachmentTrayProps {
  items: PendingAttachment[];
  error: string | null;
  onRemove: (localId: string) => void;
}

/**
 * The strip of files waiting under the composer. Each one is already on its
 * way to the server, so the tile shows how far it has got and stays removable
 * throughout — cancelling a 9 MB upload is the whole point of showing it.
 */
export function AttachmentTray({ items, error, onRemove }: AttachmentTrayProps) {
  if (items.length === 0 && !error) return null;

  return (
    <div className="border-border flex flex-col gap-1.5 border-t px-3 py-2">
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Tile key={item.localId} item={item} onRemove={onRemove} />
          ))}
        </div>
      ) : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

function Tile({
  item,
  onRemove,
}: {
  item: PendingAttachment;
  onRemove: (localId: string) => void;
}) {
  const failed = item.status === "failed";

  return (
    <div
      className={cn(
        "group/tile bg-background-2 border-border relative flex items-center gap-2 rounded-lg border p-1.5 pr-7",
        failed && "border-destructive/60",
      )}
    >
      {item.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.previewUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded object-cover"
        />
      ) : (
        <span className="bg-grayAlpha-100 text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded">
          <FileText size={16} />
        </span>
      )}

      <span className="flex min-w-0 flex-col">
        <span className="text-foreground max-w-40 truncate text-xs">
          {item.name}
        </span>
        <span
          className={cn(
            "text-muted-foreground text-[11px]",
            failed && "text-destructive",
          )}
        >
          {failed
            ? (item.error ?? "Upload failed.")
            : item.status === "uploading"
              ? `${Math.round(item.progress * 100)}%`
              : formatBytes(item.size)}
        </span>

        {item.status === "uploading" ? (
          <span className="bg-grayAlpha-100 mt-1 h-0.5 w-full overflow-hidden rounded-full">
            <span
              className="bg-primary block h-full transition-[width] duration-150"
              style={{ width: `${Math.max(item.progress, 0.05) * 100}%` }}
            />
          </span>
        ) : null}
      </span>

      <button
        type="button"
        aria-label={`Remove ${item.name}`}
        title="Remove"
        onClick={() => onRemove(item.localId)}
        className="text-muted-foreground hover:text-foreground hover:bg-grayAlpha-100 absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded"
      >
        <X size={12} />
      </button>
    </div>
  );
}

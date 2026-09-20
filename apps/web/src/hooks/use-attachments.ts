"use client";

import type { MessageAttachment } from "@roster/api";
import { useCallback, useEffect, useRef, useState } from "react";

import { LOCAL_REFUSALS, triageFiles } from "~/utils/attachments";
import { uploadAttachment } from "~/utils/upload-attachment";

export interface PendingAttachment {
  localId: string;
  name: string;
  size: number;
  mimeType: string;
  previewUrl: string | null;
  progress: number;
  status: "uploading" | "ready" | "failed";
  error?: string;
  attachment?: MessageAttachment;
}

export function useAttachments(projectId: string) {
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef<PendingAttachment[]>([]);
  const aborts = useRef(new Map<string, () => void>());

  const commit = useCallback((next: PendingAttachment[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const patch = useCallback(
    (localId: string, changes: Partial<PendingAttachment>) => {
      commit(
        itemsRef.current.map((item) =>
          item.localId === localId ? { ...item, ...changes } : item,
        ),
      );
    },
    [commit],
  );

  const forget = useCallback((item: PendingAttachment) => {
    aborts.current.get(item.localId)?.();
    aborts.current.delete(item.localId);
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      const { accepted, refusals } = triageFiles(files, itemsRef.current.length);
      const [firstRefusal] = refusals;
      setError(firstRefusal ? LOCAL_REFUSALS[firstRefusal] : null);
      if (accepted.length === 0) return;

      const added = accepted.map((file) => {
        const localId = crypto.randomUUID();

        const upload = uploadAttachment({
          file,
          projectId,
          onProgress: (fraction) => patch(localId, { progress: fraction }),
        });
        aborts.current.set(localId, upload.abort);

        void upload.done
          .then((attachment) => {
            patch(localId, { status: "ready", progress: 1, attachment });
            aborts.current.delete(localId);
          })
          .catch((cause: Error) => {
            if (!aborts.current.has(localId)) return;
            aborts.current.delete(localId);
            patch(localId, { status: "failed", error: cause.message });
          });

        return {
          localId,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          previewUrl: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : null,
          progress: 0,
          status: "uploading",
        } satisfies PendingAttachment;
      });

      commit([...itemsRef.current, ...added]);
    },
    [commit, patch, projectId],
  );

  const remove = useCallback(
    (localId: string) => {
      const item = itemsRef.current.find((entry) => entry.localId === localId);
      if (item) forget(item);
      commit(itemsRef.current.filter((entry) => entry.localId !== localId));
      setError(null);
    },
    [commit, forget],
  );

  const clear = useCallback(() => {
    for (const item of itemsRef.current) forget(item);
    commit([]);
    setError(null);
  }, [commit, forget]);

  useEffect(() => {
    const running = aborts.current;
    return () => {
      for (const abort of running.values()) abort();
    };
  }, []);

  const ready = items.filter(
    (item): item is PendingAttachment & { attachment: MessageAttachment } =>
      item.attachment !== undefined,
  );

  return {
    items,
    error,
    addFiles,
    remove,
    clear,
    attachmentIds: ready.map((item) => item.attachment.id),
    attachments: ready.map((item) => item.attachment),
    uploading: items.some((item) => item.status === "uploading"),
    count: items.length,
  };
}

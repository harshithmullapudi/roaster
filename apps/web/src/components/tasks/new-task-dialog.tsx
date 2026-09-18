"use client";

import type { ChannelGroups, TaskStatus } from "@roster/api";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Switch,
} from "@roster/ui";
import { Hash, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { errorMessage, trpc } from "~/utils/trpc";

import { ChannelPicker, flattenChannels } from "./channel-picker";
import { StatusPicker } from "./status-picker";

export interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channels: ChannelGroups;
  defaultProjectId?: string | null;
}

export function NewTaskDialog({
  open,
  onOpenChange,
  channels,
  defaultProjectId,
}: NewTaskDialogProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [projectId, setProjectId] = useState<string | null>(
    defaultProjectId ?? null,
  );
  const [createMore, setCreateMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setStatus("todo");
    setProjectId(defaultProjectId ?? null);
    setError(null);
  }, [open, defaultProjectId]);

  const submit = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setError(null);
    try {
      await trpc.tasks.create.mutate({
        title: trimmed,
        status,
        ...(projectId ? { projectId } : {}),
      });

      router.refresh();

      if (createMore) {
        setTitle("");
        titleRef.current?.focus();
      } else {
        onOpenChange(false);
      }
    } catch (cause) {
      setError(errorMessage(cause, "Could not create the task."));
    } finally {
      setSaving(false);
    }
  }, [
    title,
    projectId,
    saving,
    status,
    createMore,
    router,
    onOpenChange,
  ]);

  const selected = flattenChannels(channels).find((c) => c.id === projectId);
  const canSubmit = Boolean(title.trim()) && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="top-[18%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
        }}
      >
        <DialogTitle className="text-muted-foreground flex items-center gap-1.5 px-4 pt-4 text-xs font-normal">
          {selected ? (
            <span className="flex items-center gap-1">
              <Hash size={12} />
              {selected.slug}
            </span>
          ) : (
            "Roster"
          )}
          <span className="opacity-50">›</span>
          <span>New task</span>
        </DialogTitle>
        <DialogDescription className="sr-only">
          Create a task. Give it a channel to start that channel&apos;s agent on
          it, or leave it in the backlog.
        </DialogDescription>

        <div className="flex flex-col gap-1 px-4 pb-1 pt-3">
          <input
            ref={titleRef}
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="Task title"
            className="placeholder:text-muted-foreground bg-transparent text-lg focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
          <StatusPicker value={status} onChange={setStatus} />
          <ChannelPicker
            channels={channels}
            value={projectId}
            onChange={setProjectId}
            clearable
          />
          <span className="text-muted-foreground text-xs">
            {selected
              ? `#${selected.slug}'s agent starts on it`
              : "Waits in the backlog"}
          </span>
        </div>

        {error && (
          <p className="text-destructive px-4 pb-2 text-sm" role="alert">
            {error}
          </p>
        )}

        <div className="border-border flex items-center gap-3 border-t px-4 py-2.5">
          <label className="text-muted-foreground ml-auto flex items-center gap-2 text-xs">
            <Switch
              checked={createMore}
              onCheckedChange={setCreateMore}
              aria-label="Create more"
            />
            Create more
          </label>
          <Button disabled={!canSubmit} onClick={() => void submit()}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : "Create task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

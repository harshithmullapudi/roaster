"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@roster/ui";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { useSyncExternalStore } from "react";

import {
  dismissToast,
  readToasts,
  subscribeToasts,
  type ToastTone,
} from "~/utils/toast-store";

function ToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === "loading") {
    return (
      <Loader2 size={16} className="text-muted-foreground mt-0.5 animate-spin" />
    );
  }
  if (tone === "success") {
    return <CircleCheck size={16} className="text-success mt-0.5" />;
  }
  return <CircleAlert size={16} className="text-destructive mt-0.5" />;
}

export function Toaster() {
  const toasts = useSyncExternalStore(
    subscribeToasts,
    readToasts,
    readToasts,
  );

  return (
    <ToastProvider>
      {toasts.map((note) => (
        <Toast
          key={note.id}
          duration={note.duration}
          type={note.tone === "loading" ? "background" : "foreground"}
          onOpenChange={(open) => {
            if (!open) dismissToast(note.id);
          }}
        >
          <ToneIcon tone={note.tone} />
          <div className="min-w-0 flex-1">
            <ToastTitle>{note.title}</ToastTitle>
            {note.description ? (
              <ToastDescription>{note.description}</ToastDescription>
            ) : null}
          </div>
          {note.tone === "loading" ? null : <ToastClose />}
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

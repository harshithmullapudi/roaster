"use client";

import type { MessageAttachment } from "@roster/api";
import { Button, cn } from "@roster/ui";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import { SendHorizonal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAttachments } from "~/hooks/use-attachments";
import {
  ACCEPT_ATTRIBUTE,
  filesFromTransfer,
  transferHasFiles,
} from "~/utils/attachments";
import { submitsOnEnter } from "~/utils/composer-keys";
import { isMentionSuggestionOpen } from "~/utils/mention-suggestion";
import type { MentionItem } from "~/utils/mentions";
import { composerExtensions } from "~/utils/tiptap-extensions";
import { trpc } from "~/utils/trpc";

import { AttachmentTray } from "./attachment-tray";
import { ComposerToolbar } from "./composer-toolbar";

export interface ComposerSendPayload {
  body: unknown;
  text: string;
  attachmentIds: string[];
  /** The uploaded rows, so the pending message shows its files right away. */
  attachments: MessageAttachment[];
}

export interface ComposerProps {
  placeholder: string;
  projectId: string;
  onSend: (payload: ComposerSendPayload) => void;
}

function isTouchKeyboard() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function Composer({ placeholder, projectId, onSend }: ComposerProps) {
  const sendRef = useRef(onSend);
  sendRef.current = onSend;

  const editorRef = useRef<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);

  const attachments = useAttachments(projectId);

  /**
   * The handlers below are installed on the editor once, when it mounts, so
   * they read the attachment state through a ref rather than the closure they
   * were created in.
   */
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  /**
   * Held in a ref, not state: the extension list is built once when the editor
   * mounts, so the suggestion closure must read the latest agents rather than
   * the empty array it was created with.
   */
  const mentionsRef = useRef<MentionItem[]>([]);
  const getMentions = useMemo(() => () => mentionsRef.current, []);

  useEffect(() => {
    let live = true;
    void trpc.channels.mentionable
      .query()
      .then((items) => {
        if (live) mentionsRef.current = items;
      })
      .catch(() => {
        // Autocomplete is a convenience; typing the handle by hand still works.
      });
    return () => {
      live = false;
    };
  }, []);

  const submit = useCallback((instance: Editor) => {
    const text = instance.getText().trim();
    const tray = attachmentsRef.current;

    /** Files alone are a message; an empty composer is not. */
    if (text.length === 0 && tray.attachmentIds.length === 0) return false;
    // Sending now would drop whatever is still on its way up.
    if (tray.uploading) return false;

    sendRef.current({
      body: instance.getJSON(),
      text,
      attachmentIds: tray.attachmentIds,
      attachments: tray.attachments,
    });
    tray.clear();

    queueMicrotask(() => {
      instance.chain().focus().clearContent(true).unsetAllMarks().run();
    });
    return true;
  }, []);

  const editor = useEditor({
    extensions: composerExtensions(placeholder, getMentions),
    immediatelyRender: false,
    autofocus: isTouchKeyboard() ? false : "end",
    editorProps: {
      attributes: {
        class: "tiptap max-w-full focus:outline-none",
      },
      /**
       * ProseMirror's `someProp` consults `editorProps` before plugin props, so
       * this handler sees Enter before the mention suggestion plugin does.
       * Sending here unconditionally is what swallowed the popup's Enter.
       */
      handleKeyDown(view, event) {
        const send = submitsOnEnter(event, {
          suggestionOpen: isMentionSuggestionOpen(view.state),
          touchKeyboard: isTouchKeyboard(),
        });
        if (!send || !editorRef.current) return false;
        event.preventDefault();
        submit(editorRef.current);
        return true;
      },
      /**
       * A screenshot on the clipboard becomes an attachment, the way it does
       * in Slack. Copied text and rich text are untouched: only a paste that
       * actually carries files is claimed here.
       */
      handlePaste(_view, event) {
        const files = filesFromTransfer(event.clipboardData);
        if (files.length === 0) return false;
        event.preventDefault();
        attachmentsRef.current.addFiles(files);
        return true;
      },
      handleDrop(_view, event) {
        const transfer = (event as DragEvent).dataTransfer;
        const files = filesFromTransfer(transfer);
        if (files.length === 0) return false;
        event.preventDefault();
        attachmentsRef.current.addFiles(files);
        return true;
      },
    },
  });

  editorRef.current = editor;

  if (!editor) {
    return (
      <div className="bg-background-3 border-border h-28 rounded-xl border" />
    );
  }

  const blocked = attachments.uploading;

  return (
    <div
      className={cn(
        "bg-background-3 border-border relative flex flex-col rounded-xl border",
        draggingOver && "border-primary",
      )}
      onDragOver={(event) => {
        if (!transferHasFiles(event.dataTransfer)) return;
        event.preventDefault();
        setDraggingOver(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDraggingOver(false);
      }}
      onDrop={(event) => {
        setDraggingOver(false);
        if (!transferHasFiles(event.dataTransfer)) return;
        /**
         * A drop onto the text area is claimed by the editor's own handler
         * first, which marks the event handled. Without this check the same
         * files would be attached twice — once there, once here.
         */
        if (event.defaultPrevented) return;
        event.preventDefault();
        attachments.addFiles(filesFromTransfer(event.dataTransfer));
      }}
    >
      {draggingOver ? (
        <div className="bg-background-3/85 text-muted-foreground pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl text-sm">
          Drop to attach
        </div>
      ) : null}

      <ComposerToolbar
        editor={editor}
        onAttach={() => fileInputRef.current?.click()}
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(event) => {
          attachments.addFiles(Array.from(event.target.files ?? []));
          // Same file twice in a row still fires a change event.
          event.target.value = "";
        }}
      />

      <EditorContent
        editor={editor}
        className="editor-container max-h-60 overflow-y-auto px-3 py-2"
      />

      <AttachmentTray
        items={attachments.items}
        error={attachments.error}
        onRemove={attachments.remove}
      />

      <div className="flex items-center justify-end gap-2 px-2 pt-1 pb-2">
        <span className="text-muted-foreground mr-auto hidden px-1 text-xs sm:inline">
          {blocked
            ? "Uploading…"
            : "Enter to send · Shift+Enter for a new line"}
        </span>
        <Button
          size="sm"
          aria-label="Send message"
          disabled={blocked}
          onClick={() => submit(editor)}
        >
          <SendHorizonal size={14} />
        </Button>
      </div>
    </div>
  );
}

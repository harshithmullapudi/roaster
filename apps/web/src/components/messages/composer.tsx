"use client";

import { Button } from "@roster/ui";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import { SendHorizonal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { MentionItem } from "~/utils/mentions";
import { composerExtensions } from "~/utils/tiptap-extensions";
import { trpc } from "~/utils/trpc";

import { ComposerToolbar } from "./composer-toolbar";

export interface ComposerProps {
  placeholder: string;
  onSend: (payload: { body: unknown; text: string }) => void;
}

function isTouchKeyboard() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function Composer({ placeholder, onSend }: ComposerProps) {
  const sendRef = useRef(onSend);
  sendRef.current = onSend;

  const editorRef = useRef<Editor | null>(null);

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
    if (text.length === 0) return false;
    sendRef.current({ body: instance.getJSON(), text });
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
      handleKeyDown(_view, event) {
        if (event.key !== "Enter" || event.shiftKey) return false;
        if (event.isComposing || event.keyCode === 229) return false;
        if (isTouchKeyboard()) return false;
        if (!editorRef.current) return false;
        event.preventDefault();
        submit(editorRef.current);
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

  return (
    <div className="bg-background-3 border-border flex flex-col rounded-xl border">
      <ComposerToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="editor-container max-h-60 overflow-y-auto px-3 py-2"
      />
      <div className="flex items-center justify-end gap-2 px-2 pt-1 pb-2">
        <span className="text-muted-foreground mr-auto hidden px-1 text-xs sm:inline">
          Enter to send · Shift+Enter for a new line
        </span>
        <Button
          size="sm"
          aria-label="Send message"
          onClick={() => submit(editor)}
        >
          <SendHorizonal size={14} />
        </Button>
      </div>
    </div>
  );
}

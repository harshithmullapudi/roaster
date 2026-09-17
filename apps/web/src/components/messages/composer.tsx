"use client";

import { Button } from "@roster/ui";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import { SendHorizonal } from "lucide-react";
import { useCallback, useRef } from "react";

import { composerExtensions } from "~/utils/tiptap-extensions";

import { ComposerToolbar } from "./composer-toolbar";

export interface ComposerProps {
  placeholder: string;
  onSend: (payload: { body: unknown; text: string }) => void;
}

export function Composer({ placeholder, onSend }: ComposerProps) {
  const sendRef = useRef(onSend);
  sendRef.current = onSend;

  const editorRef = useRef<Editor | null>(null);

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
    extensions: composerExtensions(placeholder),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap max-w-full focus:outline-none",
      },
      handleKeyDown(_view, event) {
        if (event.key !== "Enter" || event.shiftKey) return false;
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
      <div className="flex items-center justify-between px-2 pt-1 pb-2">
        <span className="text-muted-foreground px-1 text-xs">
          Enter to send · Shift+Enter for a new line
        </span>
        <Button size="sm" onClick={() => submit(editor)}>
          <SendHorizonal size={14} />
        </Button>
      </div>
    </div>
  );
}

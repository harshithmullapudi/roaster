"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";

import { mentionHighlightKey } from "~/utils/mention-highlight";
import { subscribeMentions } from "~/utils/mention-store";
import { richTextExtensions } from "~/utils/tiptap-extensions";

export interface MessageBodyProps {
  body: unknown;
  text: string;
}

export function MessageBody({ body, text }: MessageBodyProps) {
  const editor = useEditor({
    extensions: richTextExtensions,
    editable: false,
    immediatelyRender: false,
    content: (body ?? text) as never,
    editorProps: {
      attributes: { class: "tiptap focus:outline-none max-w-full" },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent((body ?? text) as never, { emitUpdate: false });
  }, [editor, body, text]);

  useEffect(() => {
    if (!editor) return;
    return subscribeMentions(() => {
      if (editor.isDestroyed) return;
      editor.view.dispatch(
        editor.state.tr.setMeta(mentionHighlightKey, true),
      );
    });
  }, [editor]);

  if (!editor) {
    return <p className="text-base leading-[22px] whitespace-pre-wrap">{text}</p>;
  }

  return <EditorContent editor={editor} className="editor-container" />;
}

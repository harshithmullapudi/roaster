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

  /**
   * Mentions are decorated from a list fetched once for the whole app. A body
   * rendered before it lands has no pills, so nudge the view when it arrives —
   * an empty transaction flagged for the decoration plugin to recompute.
   */
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

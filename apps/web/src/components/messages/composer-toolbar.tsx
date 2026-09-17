"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";

import { ToolbarButton } from "./toolbar-button";

export interface ComposerToolbarProps {
  editor: Editor;
}

export function ComposerToolbar({ editor }: ComposerToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance.isActive("bold"),
      italic: instance.isActive("italic"),
      underline: instance.isActive("underline"),
      strike: instance.isActive("strike"),
      link: instance.isActive("link"),
      orderedList: instance.isActive("orderedList"),
      bulletList: instance.isActive("bulletList"),
      blockquote: instance.isActive("blockquote"),
      codeBlock: instance.isActive("codeBlock"),
    }),
  });

  function toggleLink() {
    if (state.link) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const href = window.prompt("Link URL");
    if (!href) return;
    editor.chain().focus().setLink({ href }).run();
  }

  return (
    <div className="border-border no-scrollbar flex items-center gap-0.5 overflow-x-auto border-b px-2 py-1">
      <ToolbarButton
        title="Bold"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Underline"
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Strikethrough"
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={14} />
      </ToolbarButton>

      <div className="bg-border mx-1 h-4 w-px shrink-0" />

      <ToolbarButton title="Link" active={state.link} onClick={toggleLink}>
        <LinkIcon size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Ordered list"
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Bullet list"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Blockquote"
        active={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Code block"
        active={state.codeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code size={14} />
      </ToolbarButton>
    </div>
  );
}

export interface TiptapDoc {
  type: "doc";
  content: Array<{
    type: "paragraph";
    content?: Array<{ type: "text"; text: string }>;
  }>;
}

export function textToTiptap(text: string): TiptapDoc {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const content = lines.map((line) =>
    line.length > 0
      ? { type: "paragraph" as const, content: [{ type: "text" as const, text: line }] }
      : { type: "paragraph" as const },
  );
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

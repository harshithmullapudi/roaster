import { Lexer, type Token, type Tokens } from "marked";

export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export interface TiptapDoc {
  type: "doc";
  content: TiptapNode[];
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

export function markdownToTiptap(markdown: string): TiptapDoc {
  const tokens = Lexer.lex(withDelimiterRows(markdown.replace(/\r\n/g, "\n")), {
    gfm: true,
    breaks: true,
  });

  const content = tokens.flatMap(blockNodes);

  return {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}

const FENCE = /^\s*(?:```|~~~)/;
const DELIMITER_CELL = /^:?-+:?$/;

function pipeCells(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}

function isPipeRow(line: string | undefined): line is string {
  if (line === undefined) return false;
  const trimmed = line.trim();
  return trimmed.length > 1 && trimmed.startsWith("|") && trimmed.endsWith("|");
}

function isDelimiterRow(line: string): boolean {
  return pipeCells(line).every((cell) => DELIMITER_CELL.test(cell));
}

function withDelimiterRows(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let fenced = false;

  lines.forEach((line, index) => {
    if (FENCE.test(line)) fenced = !fenced;
    out.push(line);
    if (fenced) return;

    const next = lines[index + 1];
    const startsTable =
      isPipeRow(line) &&
      !isPipeRow(lines[index - 1]) &&
      isPipeRow(next) &&
      !isDelimiterRow(next);

    if (startsTable) out.push(`|${" --- |".repeat(pipeCells(line).length)}`);
  });

  return out.join("\n");
}

function blockNodes(token: Token): TiptapNode[] {
  switch (token.type) {
    case "space":
    case "def":
      return [];

    case "heading": {
      const heading = token as Tokens.Heading;
      return [
        {
          type: "heading",
          attrs: { level: Math.min(heading.depth, 3) },
          ...withContent(inlineNodes(heading.tokens)),
        },
      ];
    }

    case "paragraph":
      return [paragraph(inlineNodes((token as Tokens.Paragraph).tokens))];

    case "text": {
      const text = token as Tokens.Text;
      return [
        paragraph(
          text.tokens
            ? inlineNodes(text.tokens)
            : textNodes(decodeEntities(text.text)),
        ),
      ];
    }

    case "code": {
      const code = token as Tokens.Code;
      return [
        {
          type: "codeBlock",
          attrs: { language: code.lang ? code.lang.split(/\s/)[0] : null },
          ...withContent(textNodes(code.text)),
        },
      ];
    }

    case "blockquote": {
      const quote = token as Tokens.Blockquote;
      const inner = quote.tokens.flatMap(blockNodes);
      return [
        {
          type: "blockquote",
          content: inner.length > 0 ? inner : [{ type: "paragraph" }],
        },
      ];
    }

    case "list": {
      const list = token as Tokens.List;
      return [
        {
          type: list.ordered ? "orderedList" : "bulletList",
          ...(list.ordered && typeof list.start === "number"
            ? { attrs: { start: list.start } }
            : {}),
          content: list.items.map(listItem),
        },
      ];
    }

    case "hr":
      return [{ type: "horizontalRule" }];

    case "table": {
      const table = token as Tokens.Table;
      return [
        {
          type: "table",
          content: [
            tableRow(table.header, "tableHeader"),
            ...table.rows.map((row) => tableRow(row, "tableCell")),
          ],
        },
      ];
    }

    default: {
      const generic = token as Tokens.Generic;
      if (generic.tokens) return [paragraph(inlineNodes(generic.tokens))];
      const raw = (generic.text ?? generic.raw ?? "").trim();
      return raw.length > 0 ? [paragraph(textNodes(raw))] : [];
    }
  }
}

function tableRow(cells: Tokens.TableCell[], cell: string): TiptapNode {
  return {
    type: "tableRow",
    content: cells.map((column) => ({
      type: cell,
      attrs: { colspan: 1, rowspan: 1, colwidth: null },
      content: [paragraph(inlineNodes(column.tokens))],
    })),
  };
}

function listItem(item: Tokens.ListItem): TiptapNode {
  const content = item.tokens.flatMap(blockNodes);
  return {
    type: "listItem",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}

function inlineNodes(tokens: Token[], marks: TiptapMark[] = []): TiptapNode[] {
  return tokens.flatMap((token) => {
    switch (token.type) {
      case "text": {
        const text = token as Tokens.Text;
        return text.tokens
          ? inlineNodes(text.tokens, marks)
          : textNodes(decodeEntities(text.text), marks);
      }

      case "escape":
        return textNodes((token as Tokens.Escape).text, marks);

      case "strong":
        return inlineNodes((token as Tokens.Strong).tokens, [
          ...marks,
          { type: "bold" },
        ]);

      case "em":
        return inlineNodes((token as Tokens.Em).tokens, [
          ...marks,
          { type: "italic" },
        ]);

      case "del":
        return inlineNodes((token as Tokens.Del).tokens, [
          ...marks,
          { type: "strike" },
        ]);

      case "codespan":
        return textNodes(decodeEntities((token as Tokens.Codespan).text), [
          ...marks,
          { type: "code" },
        ]);

      case "link": {
        const link = token as Tokens.Link;
        const linked = [...marks, { type: "link", attrs: { href: link.href } }];
        return link.tokens.length > 0
          ? inlineNodes(link.tokens, linked)
          : textNodes(decodeEntities(link.text || link.href), linked);
      }

      case "image": {
        const image = token as Tokens.Image;
        return textNodes(image.text || image.href, [
          ...marks,
          { type: "link", attrs: { href: image.href } },
        ]);
      }

      case "br":
        return [{ type: "hardBreak" }];

      case "checkbox":
        return textNodes(
          (token as Tokens.Checkbox).checked ? "☑ " : "☐ ",
          marks,
        );

      default: {
        const generic = token as Tokens.Generic;
        if (generic.tokens) return inlineNodes(generic.tokens, marks);
        return textNodes(decodeEntities(generic.text ?? generic.raw ?? ""), marks);
      }
    }
  });
}

function paragraph(content: TiptapNode[]): TiptapNode {
  return { type: "paragraph", ...withContent(content) };
}

function withContent(content: TiptapNode[]): { content?: TiptapNode[] } {
  return content.length > 0 ? { content } : {};
}

function textNodes(text: string, marks: TiptapMark[] = []): TiptapNode[] {
  if (text.length === 0) return [];
  return [{ type: "text", text, ...(marks.length > 0 ? { marks } : {}) }];
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (match) => ENTITIES[match] ?? match);
}

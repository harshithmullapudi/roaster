import {
  getAttributesFromExtensions,
  resolveExtensions,
  splitExtensions,
} from "@tiptap/core";
import { renderJSONContentToReactElement } from "@tiptap/static-renderer/json/react";
import {
  domOutputSpecToReactElement,
  mapMarkExtensionToReactNode,
  mapNodeExtensionToReactNode,
} from "@tiptap/static-renderer/pm/react";
import { Fragment, type ReactNode } from "react";

import { findMentions } from "./mention-matches";
import { knownMentions } from "./mention-store";
import { richTextExtensions } from "./tiptap-extensions";

type JsonNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

type NodeRender = (props: {
  node: JsonNode;
  children?: ReactNode;
}) => ReactNode;

type MarkRender = (props: { children?: ReactNode }) => ReactNode;

const resolved = resolveExtensions([...richTextExtensions]);
const attributes = getAttributesFromExtensions(resolved);
const { nodeExtensions, markExtensions } = splitExtensions(resolved);

function mentionSpans(text: string): ReactNode {
  const candidates = knownMentions();
  if (candidates.length === 0) return text;

  const matches = findMentions(text, candidates);
  if (matches.length === 0) return text;

  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.from > cursor) parts.push(text.slice(cursor, match.from));
    parts.push(
      <span
        key={match.from}
        className="mention"
        data-mention-handle={match.handle}
        data-kind={match.kind}
      >
        {text.slice(match.from, match.to)}
      </span>,
    );
    cursor = match.to;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));

  return <Fragment>{parts}</Fragment>;
}

const REACT_ATTRIBUTE_NAMES: Record<string, string> = {
  spellcheck: "spellCheck",
  autocomplete: "autoComplete",
  tabindex: "tabIndex",
  colspan: "colSpan",
  rowspan: "rowSpan",
};

function withReactAttributeNames(spec: unknown): unknown {
  if (!Array.isArray(spec)) return spec;

  const [tag, attrs, ...rest] = spec as unknown[];
  if (
    typeof attrs !== "object" ||
    attrs === null ||
    Array.isArray(attrs)
  ) {
    return spec;
  }

  const renamed = Object.fromEntries(
    Object.entries(attrs as Record<string, unknown>).map(([name, value]) => [
      REACT_ATTRIBUTE_NAMES[name] ?? name,
      value,
    ]),
  );

  return [tag, renamed, ...rest];
}

const toReactElement = ((spec: unknown) =>
  domOutputSpecToReactElement(
    withReactAttributeNames(spec) as never,
  )) as typeof domOutputSpecToReactElement;

const derivedNodes = Object.fromEntries(
  nodeExtensions
    .filter((extension) => extension.name !== "doc" && extension.name !== "text")
    .map((extension) =>
      mapNodeExtensionToReactNode(toReactElement, extension, attributes),
    ),
) as unknown as Record<string, NodeRender>;

const derivedMarks = Object.fromEntries(
  markExtensions.map((extension) =>
    mapMarkExtensionToReactNode(toReactElement, extension, attributes),
  ),
) as unknown as Record<string, MarkRender>;

const keepChildren: NodeRender = ({ children }) => (
  <Fragment>{children}</Fragment>
);

const keepMarkChildren: MarkRender = ({ children }) => (
  <Fragment>{children}</Fragment>
);

const nodeMapping: Record<string, NodeRender> = {
  ...derivedNodes,
  doc: keepChildren,
  text: ({ node }) => mentionSpans(node.text ?? ""),
};

const markMapping: Record<string, MarkRender> = {
  ...derivedMarks,
};

function renderer() {
  return renderJSONContentToReactElement({
    nodeMapping,
    markMapping,
    unhandledNode: keepChildren,
    unhandledMark: keepMarkChildren,
  } as never) as (input: { content: JsonNode }) => ReactNode;
}

function isDoc(body: unknown): body is JsonNode {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as JsonNode).type === "doc"
  );
}

export function renderMessageBody(body: unknown, text: string): ReactNode {
  if (!isDoc(body)) {
    return (
      <p className="paragraph-node leading-[22px]">{mentionSpans(text)}</p>
    );
  }
  return renderer()({ content: body });
}

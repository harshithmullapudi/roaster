"use client";

import { useSyncExternalStore } from "react";

import { knownMentions, subscribeMentions } from "~/utils/mention-store";
import { renderMessageBody } from "~/utils/render-message";

export interface MessageBodyProps {
  body: unknown;
  text: string;
}

export function MessageBody({ body, text }: MessageBodyProps) {
  useSyncExternalStore(subscribeMentions, knownMentions, knownMentions);

  return (
    <div className="editor-container">
      <div className="tiptap max-w-full">{renderMessageBody(body, text)}</div>
    </div>
  );
}

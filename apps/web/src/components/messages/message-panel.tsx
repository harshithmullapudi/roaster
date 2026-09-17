"use client";

import { useEffect, useRef, useState } from "react";

import type { MessageItem } from "~/types";
import { trpc } from "~/utils/trpc";

import { Composer } from "./composer";
import { MessageList } from "./message-list";

export interface MessagePanelProps {
  projectId: string;
  channelName: string;
  authorName: string;
  authorEmail: string;
  initialMessages: MessageItem[];
}

export function MessagePanel({
  projectId,
  channelName,
  authorName,
  authorEmail,
  initialMessages,
}: MessagePanelProps) {
  const [messages, setMessages] = useState(initialMessages);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMessages(initialMessages), [initialMessages]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  async function send(payload: { body: unknown; text: string }) {
    const clientId = crypto.randomUUID();
    const optimistic: MessageItem = {
      id: clientId,
      projectId,
      seq: Number.MAX_SAFE_INTEGER,
      kind: "user",
      body: payload.body,
      text: payload.text,
      clientId,
      parentMessageId: null,
      createdAt: new Date(),
      editedAt: null,
      authorMemberId: null,
      authorName,
      authorEmail,
      pending: true,
    };

    setMessages((previous) => [...previous, optimistic]);

    try {
      const saved = await trpc.messages.send.mutate({
        projectId,
        body: payload.body,
        text: payload.text,
        clientId,
      });
      setMessages((previous) =>
        previous.map((message) =>
          message.clientId === clientId ? { ...saved } : message,
        ),
      );
    } catch {
      setMessages((previous) =>
        previous.map((message) =>
          message.clientId === clientId
            ? { ...message, pending: false, failed: true }
            : message,
        ),
      );
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mt-auto w-full">
          <MessageList channelName={channelName} messages={messages} />
        </div>
      </div>
      <div className="shrink-0 px-4 pb-4">
        <Composer placeholder={`Message #${channelName}`} onSend={send} />
      </div>
    </div>
  );
}

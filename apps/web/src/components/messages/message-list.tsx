"use client";

import { Hash } from "lucide-react";

import type { MessageItem } from "~/types";
import { startsNewGroup } from "~/utils/message-groups";
import type { ThreadItem } from "~/utils/thread-rows";

import { MessageRow } from "./message-row";

export interface MessageListProps {
  channelName: string;
  messages: MessageItem[];
  threadsByRootMessage: Map<string, ThreadItem>;
  basePath: string;
  memberId: string;
  onDelete: (messageId: string) => Promise<void>;
}

export function MessageList({
  channelName,
  messages,
  threadsByRootMessage,
  basePath,
  memberId,
  onDelete,
}: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10">
        <Hash className="text-muted-foreground size-5" />
        <p className="text-base font-medium">This is #{channelName}</p>
        <p className="text-muted-foreground text-sm">
          Send the first message to get things going.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col pb-3">
      {messages.map((message, index) => {
        const thread = threadsByRootMessage.get(message.id);
        const previous = messages[index - 1];
        return (
          <MessageRow
            key={message.clientId ?? message.id}
            message={message}
            leading={startsNewGroup(
              message,
              previous,
              previous ? threadsByRootMessage.has(previous.id) : false,
            )}
            thread={thread}
            threadHref={thread ? `${basePath}?thread=${thread.id}` : undefined}
            memberId={memberId}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}

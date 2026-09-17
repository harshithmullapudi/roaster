"use client";

import { Hash } from "lucide-react";

import type { MessageItem } from "~/types";
import { startsNewGroup } from "~/utils/message-groups";

import { MessageRow } from "./message-row";

export interface MessageListProps {
  channelName: string;
  messages: MessageItem[];
}

export function MessageList({ channelName, messages }: MessageListProps) {
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
      {messages.map((message, index) => (
        <MessageRow
          key={message.clientId ?? message.id}
          message={message}
          leading={startsNewGroup(message, messages[index - 1])}
        />
      ))}
    </div>
  );
}

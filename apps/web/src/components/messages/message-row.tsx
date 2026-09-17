"use client";

import { AvatarText, cn } from "@roster/ui";

import type { MessageItem } from "~/types";
import { displayName } from "~/utils/message-groups";
import { relativeTime } from "~/utils/relative-time";

import { MessageBody } from "./message-body";

export interface MessageRowProps {
  message: MessageItem;
  leading: boolean;
}

export function MessageRow({ message, leading }: MessageRowProps) {
  const name = displayName(message.authorName, message.authorEmail);

  return (
    <div
      className={cn(
        "group/message hover:bg-grayAlpha-50 flex w-full gap-3 px-5",
        leading ? "pt-3 pb-0.5" : "py-0.5",
        message.pending && "opacity-60",
      )}
    >
      <div className="flex w-7 shrink-0 justify-center pt-0.5">
        {leading ? (
          <AvatarText text={name} className="h-7 w-7 rounded-md text-xs" />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {leading ? (
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-base font-medium">
              {name}
            </span>
            <span
              className="text-muted-foreground text-xs"
              suppressHydrationWarning
            >
              {message.pending ? "sending…" : relativeTime(message.createdAt)}
            </span>
          </div>
        ) : null}
        <div className="min-w-0">
          <MessageBody body={message.body} text={message.text} />
        </div>
        {message.failed ? (
          <span className="text-destructive text-xs">Failed to send.</span>
        ) : null}
      </div>
    </div>
  );
}

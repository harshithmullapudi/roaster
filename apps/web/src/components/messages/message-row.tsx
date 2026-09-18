"use client";

import { AvatarText, cn } from "@roster/ui";

import { ThreadAffordance } from "~/components/threads/thread-affordance";
import type { MessageItem } from "~/types";
import { speakerName } from "~/utils/message-groups";
import { relativeTime } from "~/utils/relative-time";
import type { ThreadItem } from "~/utils/thread-rows";

import { MessageActions } from "./message-actions";
import { MessageBody } from "./message-body";

export interface MessageRowProps {
  message: MessageItem;
  leading: boolean;
  thread?: ThreadItem;
  threadHref?: string;
  memberId?: string;
  onDelete?: (messageId: string) => Promise<void>;
}

export function MessageRow({
  message,
  leading,
  thread,
  threadHref,
  memberId,
  onDelete,
}: MessageRowProps) {
  const name = speakerName(message);

  const deletable =
    onDelete !== undefined &&
    memberId !== undefined &&
    message.kind === "user" &&
    message.authorMemberId === memberId &&
    !message.pending &&
    !message.failed;

  return (
    <div
      className={cn(
        "group/message hover:bg-grayAlpha-50 relative flex w-full gap-2.5 px-3 sm:gap-3 sm:px-5",
        leading ? "pt-3 pb-0.5" : "py-0.5",
        message.pending && "opacity-60",
      )}
    >
      {deletable ? (
        <MessageActions
          hasSession={Boolean(thread)}
          onDelete={() => onDelete(message.id)}
        />
      ) : null}

      <div className="flex w-7 shrink-0 justify-center pt-0.5">
        {leading ? (
          <AvatarText text={name} className="h-7 w-7 rounded-md text-xs" />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col pr-8">
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
        {thread && threadHref ? (
          <ThreadAffordance thread={thread} href={threadHref} />
        ) : null}
        {message.failed ? (
          <span className="text-destructive text-xs">Failed to send.</span>
        ) : null}
      </div>
    </div>
  );
}

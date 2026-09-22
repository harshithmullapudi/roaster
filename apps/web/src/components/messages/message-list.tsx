"use client";

import { Hash, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Virtuoso } from "react-virtuoso";

import { useTailFollow } from "~/hooks/use-tail-follow";
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
  firstItemIndex: number;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onDelete: (messageId: string) => Promise<void>;
  onSentRef?: React.MutableRefObject<(() => void) | undefined>;
}

export function MessageList({
  channelName,
  messages,
  threadsByRootMessage,
  basePath,
  memberId,
  firstItemIndex,
  loadingOlder,
  onLoadOlder,
  onDelete,
  onSentRef,
}: MessageListProps) {
  const row = useCallback(
    (virtuosoIndex: number, message: MessageItem) => {
      const position = virtuosoIndex - firstItemIndex;
      const thread = threadsByRootMessage.get(message.id);
      const previous = messages[position - 1];
      return (
        <MessageRow
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
    },
    [
      firstItemIndex,
      messages,
      threadsByRootMessage,
      basePath,
      memberId,
      onDelete,
    ],
  );

  const tail = useTailFollow({ onReachTop: onLoadOlder });
  const followedKey = useRef<string | undefined>(undefined);

  const newest = messages[messages.length - 1];
  const newestKey = newest ? (newest.clientId ?? newest.id) : undefined;

  useEffect(() => {
    if (!loadingOlder && tail.restingAtTop()) onLoadOlder();
  }, [loadingOlder, onLoadOlder, tail]);

  useEffect(() => {
    if (onSentRef) onSentRef.current = tail.stick;
  }, [onSentRef, tail.stick]);

  useEffect(() => {
    if (newestKey === undefined || newestKey === followedKey.current) return;
    followedKey.current = newestKey;
    if (tail.following()) tail.followTail();
  }, [newestKey, tail]);

  const components = useMemo(
    () => ({
      Header: () =>
        loadingOlder ? <OlderSpinner /> : <span className="block h-2" />,
      Footer: () => <span className="block h-3" />,
    }),
    [loadingOlder],
  );

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
    <Virtuoso
      className="min-h-0 flex-1"
      data={messages}
      firstItemIndex={firstItemIndex}
      initialTopMostItemIndex={{ index: "LAST", align: "end" }}
      ref={tail.listRef}
      startReached={tail.reachedTop}
      atTopStateChange={tail.atTopChanged}
      atBottomStateChange={tail.atBottomChanged}
      scrollerRef={tail.attachScroller}
      totalListHeightChanged={tail.heightChanged}
      atBottomThreshold={80}
      increaseViewportBy={{ top: 600, bottom: 600 }}
      computeItemKey={(_index, message) => message.clientId ?? message.id}
      itemContent={row}
      components={components}
    />
  );
}

function OlderSpinner() {
  return (
    <span className="flex items-center justify-center py-3">
      <Loader2 className="text-muted-foreground size-4 animate-spin" />
    </span>
  );
}

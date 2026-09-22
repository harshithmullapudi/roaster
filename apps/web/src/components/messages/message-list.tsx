"use client";

import { Hash, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

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

  const restingAtTop = useRef(false);
  const restingAtBottom = useRef(true);
  const listRef = useRef<VirtuosoHandle>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const followedKey = useRef<string | undefined>(undefined);

  const newest = messages[messages.length - 1];
  const newestKey = newest ? (newest.clientId ?? newest.id) : undefined;

  const handleTopEdge = useCallback(
    (isAtTop: boolean) => {
      restingAtTop.current = isAtTop;
      if (isAtTop) onLoadOlder();
    },
    [onLoadOlder],
  );

  useEffect(() => {
    if (!loadingOlder && restingAtTop.current) onLoadOlder();
  }, [loadingOlder, onLoadOlder]);

  const pinToBottom = useCallback(() => {
    listRef.current?.scrollToIndex({ index: "LAST", align: "end" });
    const clampPastFooter = () => {
      const scroller = scrollerRef.current;
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    };
    clampPastFooter();
    requestAnimationFrame(clampPastFooter);
  }, []);

  useEffect(() => {
    if (newestKey === undefined || newestKey === followedKey.current) return;
    const opening = followedKey.current === undefined;
    followedKey.current = newestKey;
    if (opening || restingAtBottom.current) pinToBottom();
  }, [newestKey, pinToBottom]);

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
      initialTopMostItemIndex={messages.length - 1}
      ref={listRef}
      startReached={onLoadOlder}
      atTopStateChange={handleTopEdge}
      atBottomStateChange={(isAtBottom) => {
        restingAtBottom.current = isAtBottom;
      }}
      scrollerRef={(element) => {
        scrollerRef.current = element as HTMLElement | null;
      }}
      totalListHeightChanged={() => {
        if (restingAtBottom.current) pinToBottom();
      }}
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

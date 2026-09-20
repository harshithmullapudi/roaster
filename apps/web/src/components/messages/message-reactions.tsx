"use client";

import { Button, cn, EmojiPicker } from "@roster/ui";
import { useQueryClient } from "@tanstack/react-query";
import { SmilePlus } from "lucide-react";

import type { ReactionRef } from "@roster/api";

import {
  applyReactionToCaches,
  groupReactions,
} from "~/utils/message-cache";
import { trpc } from "~/utils/trpc";

export interface MessageReactionsProps {
  messageId: string;
  projectId: string;
  reactions: ReactionRef[];
  memberId: string;
}

export function MessageReactions({
  messageId,
  projectId,
  reactions,
  memberId,
}: MessageReactionsProps) {
  const queryClient = useQueryClient();
  const groups = groupReactions(reactions, memberId);

  async function toggle(emoji: string) {
    const mine = groups.some((group) => group.emoji === emoji && group.mine);
    const base = { messageId, projectId, threadId: null, emoji, memberId };

    applyReactionToCaches(queryClient, { ...base, added: !mine });

    try {
      const result = await trpc.reactions.toggle.mutate({
        projectId,
        messageId,
        emoji,
      });
      applyReactionToCaches(queryClient, { ...base, added: result.added });
    } catch {
      console.warn("[reactions] toggle failed");
      applyReactionToCaches(queryClient, { ...base, added: mine });
    }
  }

  return (
    <>
      <EmojiPicker align="end" onSelect={(emoji) => void toggle(emoji)}>
        <Button
          variant="ghost"
          size="xs"
          aria-label="Add reaction"
          className="text-muted-foreground bg-background border-border absolute top-0 right-10 z-10 border opacity-0 shadow-sm transition-opacity focus-visible:opacity-100 group-hover/message:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100 sm:right-12"
        >
          <SmilePlus size={14} />
        </Button>
      </EmojiPicker>

      {groups.length > 0 ? (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {groups.map((group) => (
            <Button
              key={group.emoji}
              variant="secondary"
              size="xs"
              aria-label={`${group.emoji} reaction, ${group.count}`}
              aria-pressed={group.mine}
              onClick={() => void toggle(group.emoji)}
              className={cn(
                "gap-1 px-1.5 text-xs",
                group.mine &&
                  "bg-primary/10 text-primary hover:bg-primary/15 ring-primary/40 ring-1",
              )}
            >
              <span aria-hidden="true">{group.emoji}</span>
              <span className="tabular-nums">{group.count}</span>
            </Button>
          ))}
        </div>
      ) : null}
    </>
  );
}

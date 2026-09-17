"use client";

import type { Channel } from "@roster/api";
import { Button, cn } from "@roster/ui";
import { Star } from "lucide-react";
import Link from "next/link";

export interface ChannelRowProps {
  channel: Channel;
  href: string;
  active: boolean;
  onToggleStar: (channel: Channel) => void;
}

export function ChannelRow({
  channel,
  href,
  active,
  onToggleStar,
}: ChannelRowProps) {
  return (
    <div className="group/channel relative flex w-full min-w-0 items-center">
      <Button
        variant="ghost"
        isActive={active}
        full
        className={cn(
          "text-foreground min-w-0 justify-start gap-2 !rounded-md pl-2 pr-7 text-sm",
          active && "!bg-accent !text-accent-foreground",
        )}
        asChild
      >
        <Link href={href}>
          <span className="text-muted-foreground size-4 shrink-0 text-center">
            #
          </span>
          <span className="min-w-0 flex-1 truncate text-left">
            {channel.slug}
          </span>
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="xs"
        aria-label={channel.starred ? "Unstar channel" : "Star channel"}
        className={cn(
          "text-muted-foreground hover:text-foreground absolute right-1 shrink-0 !rounded-sm opacity-0 transition-opacity group-hover/channel:opacity-100 focus-visible:opacity-100",
          channel.starred && "text-foreground opacity-100",
        )}
        onClick={() => onToggleStar(channel)}
      >
        <Star size={13} fill={channel.starred ? "currentColor" : "none"} />
      </Button>
    </div>
  );
}

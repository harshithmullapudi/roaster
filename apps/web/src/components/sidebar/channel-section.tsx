"use client";

import type { Channel } from "@roster/api";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@roster/ui";
import { ChevronDown } from "lucide-react";

import { ChannelRow } from "./channel-row";

export interface ChannelSectionProps {
  label: string;
  channels: Channel[];
  open: boolean;
  orgSlug: string;
  activeChannelSlug?: string;
  onOpenChange: (open: boolean) => void;
  onToggleStar: (channel: Channel) => void;
}

export function ChannelSection({
  label,
  channels,
  open,
  orgSlug,
  activeChannelSlug,
  onOpenChange,
  onToggleStar,
}: ChannelSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="mb-1">
      <CollapsibleTrigger asChild>
        <button className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 px-2 py-1 text-sm font-light">
          {label}
          <ChevronDown
            size={14}
            className={
              open
                ? "transition-transform duration-200"
                : "-rotate-90 transition-transform duration-200"
            }
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex w-full min-w-0 flex-col gap-0.5">
          {channels.map((channel) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
              href={`/${orgSlug}/${channel.slug}`}
              active={channel.slug === activeChannelSlug}
              onToggleStar={onToggleStar}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

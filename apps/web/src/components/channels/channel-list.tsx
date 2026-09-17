import type { Channel } from "@roster/api";
import { Hash } from "lucide-react";
import Link from "next/link";

export interface ChannelListProps {
  orgSlug: string;
  channels: Channel[];
}

export function ChannelList({ orgSlug, channels }: ChannelListProps) {
  return (
    <ul className="bg-background-3 text-foreground flex flex-col divide-y rounded">
      {channels.map((channel) => (
        <li key={channel.id}>
          <Link
            href={`/${orgSlug}/${channel.slug}`}
            className="hover:bg-grayAlpha-50 flex items-center gap-2.5 px-4 py-3"
          >
            <Hash className="text-muted-foreground size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{channel.slug}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {channel.repoOwner && channel.repoName
                  ? `${channel.repoOwner}/${channel.repoName}`
                  : channel.repoPath}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

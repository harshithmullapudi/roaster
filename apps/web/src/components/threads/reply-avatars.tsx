"use client";

import { AvatarText } from "@roster/ui";

export interface ReplyAvatarsProps {
  names: string[];
}

export function ReplyAvatars({ names }: ReplyAvatarsProps) {
  if (names.length === 0) return null;

  return (
    <span className="flex shrink-0 items-center -space-x-1">
      {names.slice(0, 3).map((name) => (
        <AvatarText
          key={name}
          text={name}
          className="ring-background-2 h-5 w-5 rounded-md text-[10px] ring-2"
        />
      ))}
    </span>
  );
}

import { Button, cn } from "@roster/ui";
import Link from "next/link";

import type { ChannelTab } from "~/types";

const TABS: { value: ChannelTab; label: string }[] = [
  { value: "messages", label: "Messages" },
  { value: "tasks", label: "Tasks" },
  { value: "memory", label: "Memory" },
];

export interface ChannelTabsProps {
  basePath: string;
  channelSlug: string;
  active: ChannelTab;
}

export function ChannelTabs({
  basePath,
  channelSlug,
  active,
}: ChannelTabsProps) {
  const href = (tab: ChannelTab) =>
    tab === "tasks"
      ? `${basePath}?tab=tasks&channel=${encodeURIComponent(channelSlug)}`
      : `${basePath}?tab=${tab}`;

  return (
    <div className="flex w-max items-center gap-0.5">
      {TABS.map((tab) => (
        <Button
          key={tab.value}
          variant="ghost"
          isActive={tab.value === active}
          className={cn(
            "text-muted-foreground shrink-0 !rounded-md px-2 text-sm",
            tab.value === active &&
              "!bg-accent !text-accent-foreground",
          )}
          asChild
        >
          <Link
            href={href(tab.value)}
            aria-current={tab.value === active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}

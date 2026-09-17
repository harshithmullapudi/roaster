import { Button, cn } from "@roster/ui";
import Link from "next/link";

import type { ChannelTab } from "~/types";

const TABS: { value: ChannelTab; label: string }[] = [
  { value: "messages", label: "Messages" },
  { value: "tasks", label: "Tasks" },
  { value: "memory", label: "Memory" },
  { value: "running", label: "Running" },
];

export interface ChannelTabsProps {
  basePath: string;
  active: ChannelTab;
}

export function ChannelTabs({ basePath, active }: ChannelTabsProps) {
  return (
    <div className="flex items-center gap-0.5">
      {TABS.map((tab) => (
        <Button
          key={tab.value}
          variant="ghost"
          size="sm"
          isActive={tab.value === active}
          className={cn(
            "text-muted-foreground !rounded-md px-2 text-sm",
            tab.value === active &&
              "!bg-accent !text-accent-foreground",
          )}
          asChild
        >
          <Link
            href={`${basePath}?tab=${tab.value}`}
            aria-current={tab.value === active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}

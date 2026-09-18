"use client";

import { cn, getStatusColor } from "@roster/ui";

import { isActive } from "~/utils/thread-rows";

const SLOTS: Record<string, string> = {
  starting: "4",
  running: "5",
  // Parked on another agent. Its own colour, because the grey fallback read as
  // a session that had finished.
  waiting: "1",
  failed: "0",
  canceled: "3",
};

export function sessionStatusColor(status: string) {
  // A finished session is the one green in the app — use the shared success
  // token rather than a status slot.
  if (status === "completed") {
    return {
      background: "color-mix(in oklab, var(--success) 15%, transparent)",
      color: "var(--success)",
    };
  }

  return getStatusColor(SLOTS[status] ?? "3");
}

export interface SessionStatusIconProps {
  status: string;
  size?: number;
  className?: string;
}

/** The dot that sits where the task list puts its status icon. */
export function SessionStatusIcon({
  status,
  size = 18,
  className,
}: SessionStatusIconProps) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <span
        className={cn("rounded-full", isActive(status) && "animate-pulse")}
        style={{
          width: Math.round(size / 2),
          height: Math.round(size / 2),
          backgroundColor: sessionStatusColor(status).color,
        }}
      />
    </span>
  );
}

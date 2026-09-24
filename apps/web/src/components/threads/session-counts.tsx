"use client";

import { cn } from "@roster/ui";

import { CountFlash } from "./count-flash";

export interface SessionCountsProps {
  running: number;
  needsInput: number;
  turnDone: number;
  labeled?: boolean;
  className?: string;
}

/*
 * Three counts, never summed. A session waiting on a person is the one you can
 * actually act on, so it keeps its own amber dot rather than being folded into
 * "running" — and it is still, because the pulse means work is happening. A
 * finished turn nobody has read yet is still again, in green.
 *
 * A state at zero is hidden rather than unmounted, so the jump from nothing to
 * one still reads as a rise and gets its flash.
 */
export function SessionCounts({
  running,
  needsInput,
  turnDone,
  labeled = false,
  className,
}: SessionCountsProps) {
  const states = [
    { key: "running", count: running, dot: "animate-pulse bg-blue-500", noun: "running" },
    { key: "needsInput", count: needsInput, dot: "bg-warning", noun: "needs input" },
    { key: "turnDone", count: turnDone, dot: "bg-success", noun: "done" },
  ];

  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-2 text-xs",
        running <= 0 && needsInput <= 0 && turnDone <= 0 && "hidden",
        className,
      )}
    >
      {states.map((state) => (
        <CountFlash
          key={state.key}
          value={state.count}
          className={cn(
            "flex items-center gap-1.5",
            state.count <= 0 && "hidden",
          )}
        >
          <span className={cn("size-1.5 rounded-full", state.dot)} />
          {labeled ? `${state.count} ${state.noun}` : state.count}
        </CountFlash>
      ))}
    </span>
  );
}

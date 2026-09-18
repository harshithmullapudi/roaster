"use client";

import { cn } from "@roster/ui";
import { X } from "lucide-react";

export interface SessionTab {
  terminalId: string;
  title: string | null;
  customTitle: string | null;
}

export interface SessionTabsProps {
  sessions: SessionTab[];
  activeTerminalId: string | null;
  onSelect: (terminalId: string) => void;
  onClose: (terminalId: string) => void;
}

function label(session: SessionTab): string {
  return session.customTitle ?? session.title ?? session.terminalId.slice(0, 8);
}

export function SessionTabs({
  sessions,
  activeTerminalId,
  onSelect,
  onClose,
}: SessionTabsProps) {
  return (
    <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
      {sessions.map((session) => (
        <span
          key={session.terminalId}
          className={cn(
            "group flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-xs",
            session.terminalId === activeTerminalId
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50",
          )}
        >
          <button
            type="button"
            onClick={() => onSelect(session.terminalId)}
            className="max-w-40 truncate"
          >
            {label(session)}
          </button>
          <button
            type="button"
            aria-label="Close session"
            onClick={() => onClose(session.terminalId)}
            className="opacity-0 group-hover:opacity-100"
          >
            <X size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}

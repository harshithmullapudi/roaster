"use client";

import { Globe, Lock, User } from "lucide-react";
import { useEffect, useState } from "react";

import { knownMentions, subscribeMentions } from "~/utils/mention-store";
import type { MentionItem } from "~/utils/mentions";

interface Hovered {
  item: MentionItem;
  top: number;
  left: number;
  below: boolean;
}

const CLOSE_DELAY_MS = 120;

/**
 * A single popover for every mention on the page.
 *
 * Mounted once and driven by event delegation rather than per-pill React
 * state: mention pills are ProseMirror decorations, not components, so there
 * is nothing to hang a hover handler on.
 */
export function MentionPopover() {
  const [hovered, setHovered] = useState<Hovered | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeMentions(() => {});
    let closeTimer: ReturnType<typeof setTimeout> | null = null;

    function cancelClose() {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    }

    function onOver(event: MouseEvent) {
      const target = (event.target as HTMLElement | null)?.closest?.(
        "[data-mention-handle], .mention",
      ) as HTMLElement | null;

      if (!target) return;

      const handle =
        target.dataset.mentionHandle ??
        target.textContent?.trim().replace(/^@/, "").toLowerCase();
      if (!handle) return;

      // Nothing stops a person's handle from also naming an agent, so the
      // pill's own `data-kind` decides which of the two this one is.
      const kind = target.dataset.kind === "member" ? "member" : "agent";
      const candidates = knownMentions().filter(
        (one) => one.handle === handle,
      );
      const item =
        candidates.find((one) => one.kind === kind) ?? candidates[0];
      if (!item) return;

      cancelClose();

      const rect = target.getBoundingClientRect();
      const below = rect.top < 140;
      setHovered({
        item,
        top: below ? rect.bottom + 6 : rect.top - 6,
        left: rect.left,
        below,
      });
    }

    function onOut(event: MouseEvent) {
      const target = (event.target as HTMLElement | null)?.closest?.(
        "[data-mention-handle], .mention",
      );
      if (!target) return;
      closeTimer = setTimeout(() => setHovered(null), CLOSE_DELAY_MS);
    }

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      cancelClose();
      unsubscribe();
    };
  }, []);

  if (!hovered) return null;

  const { item } = hovered;

  return (
    <div
      role="tooltip"
      className="bg-background-3 border-border pointer-events-none fixed z-50 w-64 rounded-lg border p-3 shadow-md"
      style={{
        top: hovered.top,
        left: hovered.left,
        transform: hovered.below ? undefined : "translateY(-100%)",
      }}
    >
      <p className="text-foreground text-sm font-medium">
        {item.kind === "member" ? item.name : item.display}
      </p>
      {/* Globe/Lock is how visibility reads elsewhere — channel-menu, settings. */}
      <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
        {item.kind === "member" ? (
          <User className="size-3.5 shrink-0" />
        ) : item.visibility === "private" ? (
          <Lock className="size-3.5 shrink-0" />
        ) : (
          <Globe className="size-3.5 shrink-0" />
        )}
        {item.kind === "member" ? `@${item.handle}` : item.slug}
        {item.kind !== "member" && item.visibility === "private"
          ? " · private"
          : null}
      </p>
      <p className="text-muted-foreground mt-2 text-xs">
        {item.kind === "member"
          ? "A teammate. Mention to bring them into the thread — it does not start an agent."
          : `Agent for ${item.name}. Mention to hand work over.`}
      </p>
    </div>
  );
}

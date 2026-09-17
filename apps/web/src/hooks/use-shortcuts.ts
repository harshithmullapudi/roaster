"use client";

import { useEffect, useRef } from "react";
import { tinykeys, type KeybindingsMap } from "tinykeys";

export interface Shortcut {
  /** A tinykeys pattern. `$mod` is Cmd on macOS and Ctrl elsewhere. */
  key: string;
  handler: () => void;
  /**
   * Stop the browser acting on the key. Required for $mod+k, which Chrome
   * otherwise routes to the omnibox and Arc to its own command bar.
   */
  preventDefault?: boolean;
  enabled?: boolean;
}

/**
 * Binds keyboard shortcuts for as long as the component is mounted.
 *
 * Handlers are read through a ref, so passing a fresh closure every render
 * doesn't tear down and rebind the listener — only the shortcut *keys* do.
 *
 * Note these fire while the user is typing, which is right for modifier
 * combos. A bare key ("n") would need a guard against inputs, Tiptap's
 * contenteditable and open dialogs before it could be added here.
 */
export function useShortcuts(shortcuts: Shortcut[]): void {
  const ref = useRef(shortcuts);
  ref.current = shortcuts;

  // Rebind only when the set of keys changes, not on every render.
  const signature = shortcuts.map((shortcut) => shortcut.key).join("|");

  useEffect(() => {
    const bindings: KeybindingsMap = {};

    for (const [index, shortcut] of ref.current.entries()) {
      bindings[shortcut.key] = (event: KeyboardEvent) => {
        // Re-read from the ref: by now this index may hold a newer handler.
        const current = ref.current[index];
        if (!current || current.enabled === false) return;
        if (current.preventDefault) event.preventDefault();
        current.handler();
      };
    }

    return tinykeys(window, bindings);
  }, [signature]);
}

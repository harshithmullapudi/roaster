"use client";

import { useEffect, useRef } from "react";
import { tinykeys, type KeybindingsMap } from "tinykeys";

export interface Shortcut {
  key: string;
  handler: () => void;
  preventDefault?: boolean;
  enabled?: boolean;
}

export function useShortcuts(shortcuts: Shortcut[]): void {
  const ref = useRef(shortcuts);
  ref.current = shortcuts;

  const signature = shortcuts.map((shortcut) => shortcut.key).join("|");

  useEffect(() => {
    const bindings: KeybindingsMap = {};

    for (const [index, shortcut] of ref.current.entries()) {
      bindings[shortcut.key] = (event: KeyboardEvent) => {
        const current = ref.current[index];
        if (!current || current.enabled === false) return;
        if (current.preventDefault) event.preventDefault();
        current.handler();
      };
    }

    return tinykeys(window, bindings);
  }, [signature]);
}

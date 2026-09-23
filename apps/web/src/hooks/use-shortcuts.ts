"use client";

import { useEffect, useRef } from "react";
import { tinykeys, type KeybindingsMap } from "tinykeys";

import { firesWhileTyping } from "~/utils/shortcut-keys";

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
    const whileTyping: KeybindingsMap = {};
    const whileNotTyping: KeybindingsMap = {};

    for (const [index, shortcut] of ref.current.entries()) {
      const binding = (event: KeyboardEvent) => {
        const current = ref.current[index];
        if (!current || current.enabled === false) return;
        if (current.preventDefault) event.preventDefault();
        current.handler();
      };

      if (firesWhileTyping(shortcut.key)) {
        whileTyping[shortcut.key] = binding;
      } else {
        whileNotTyping[shortcut.key] = binding;
      }
    }

    const unbind = [
      tinykeys(window, whileNotTyping),
      tinykeys(window, whileTyping, {
        ignore: (event) => event.repeat || event.isComposing,
      }),
    ];

    return () => {
      for (const stop of unbind) stop();
    };
  }, [signature]);
}

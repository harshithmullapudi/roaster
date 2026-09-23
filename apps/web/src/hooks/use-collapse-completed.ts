"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "roster:collapse-completed";

function storageKey(projectId: string): string {
  return `roster:collapse-completed:${projectId}`;
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENT, listener);
  };
}

function read(projectId: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(projectId)) !== "off";
  } catch {
    return true;
  }
}

export function useCollapseCompleted(projectId: string) {
  const collapse = useSyncExternalStore(
    subscribe,
    () => read(projectId),
    () => false,
  );

  const setCollapse = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(storageKey(projectId), next ? "on" : "off");
      } catch {
        console.warn("[channels] could not remember the collapse setting");
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [projectId],
  );

  return { collapse, setCollapse };
}

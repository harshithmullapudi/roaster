"use client";

import { useDefaultLayout } from "@roster/ui";
import type { ReactNode } from "react";

import { RailPanels } from "./rail-panels";

export interface RailLayoutProps {
  main: ReactNode;
  rail: ReactNode;
}

const SERVER_STORAGE: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

function layoutStorage(): Storage {
  return typeof window === "undefined" ? SERVER_STORAGE : window.localStorage;
}

export function RailLayout({ main, rail }: RailLayoutProps) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "roster.thread-rail",
    panelIds: ["shell-main", "shell-rail"],
    storage: layoutStorage(),
  });

  return (
    <RailPanels
      main={main}
      rail={rail}
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    />
  );
}

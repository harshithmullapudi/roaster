"use client";

import { useDefaultLayout } from "@roster/ui";
import type { ReactNode } from "react";

import { RailPanels } from "./rail-panels";

export interface PersistedRailPanelsProps {
  main: ReactNode;
  rail: ReactNode;
}

export function PersistedRailPanels({ main, rail }: PersistedRailPanelsProps) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "roster.thread-rail",
    panelIds: ["shell-main", "shell-rail"],
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

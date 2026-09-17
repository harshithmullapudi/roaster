"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@roster/ui";
import type { ComponentProps, ReactNode } from "react";

type PanelGroupProps = ComponentProps<typeof ResizablePanelGroup>;

export interface RailPanelsProps {
  main: ReactNode;
  rail: ReactNode;
  defaultLayout?: PanelGroupProps["defaultLayout"];
  onLayoutChanged?: PanelGroupProps["onLayoutChanged"];
}

export function RailPanels({
  main,
  rail,
  defaultLayout,
  onLayoutChanged,
}: RailPanelsProps) {
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      className="rail-group min-w-0 flex-1"
    >
      <ResizablePanel
        id="shell-main"
        defaultSize="65"
        minSize="35"
        className="flex min-w-0"
      >
        {main}
      </ResizablePanel>
      <ResizableHandle className="hover:bg-primary/40 transition-colors after:w-2" />
      <ResizablePanel
        id="shell-rail"
        defaultSize="35"
        minSize="24"
        maxSize="60"
        className="flex min-w-0"
      >
        {rail}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

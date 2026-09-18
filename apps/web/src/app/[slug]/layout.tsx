import type { ReactNode } from "react";

import { DockProvider } from "~/components/terminals/dock-provider";
import { DockStatusBar } from "~/components/terminals/dock-status-bar";
import { TerminalDock } from "~/components/terminals/terminal-dock";

export default function OrgLayout({ children }: { children: ReactNode }) {
  return (
    <DockProvider>
      <div className="bg-background flex h-dvh flex-col">
        <div className="min-h-0 flex-1">{children}</div>
        <TerminalDock />
        <DockStatusBar />
      </div>
    </DockProvider>
  );
}

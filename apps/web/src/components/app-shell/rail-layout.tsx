"use client";

import { type ReactNode, useEffect, useState } from "react";

import { PersistedRailPanels } from "./persisted-rail-panels";
import { RailPanels } from "./rail-panels";

export interface RailLayoutProps {
  main: ReactNode;
  rail: ReactNode;
}

export function RailLayout({ main, rail }: RailLayoutProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <RailPanels main={main} rail={rail} />;

  return <PersistedRailPanels main={main} rail={rail} />;
}

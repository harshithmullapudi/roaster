"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DockMode = "closed" | "open";

export interface DockChannel {
  orgSlug: string;
  channelSlug: string;
  projectId: string;
}

interface DockSelection {
  workspaceId: string;
  terminalId: string | null;
}

interface DockValue {
  channel: DockChannel | null;
  setChannel: (channel: DockChannel | null) => void;

  mode: DockMode;
  setMode: (mode: DockMode) => void;
  toggle: () => void;

  selection: DockSelection | null;
  select: (selection: DockSelection) => void;

  height: number;
  setHeight: (height: number) => void;
}

const DockContext = createContext<DockValue | null>(null);

const HEIGHT_KEY = "roster:dock-height";
const MIN_HEIGHT = 160;
const DEFAULT_HEIGHT = 320;

export function DockProvider({ children }: { children: ReactNode }) {
  const [channel, setChannel] = useState<DockChannel | null>(null);
  const [mode, setMode] = useState<DockMode>("closed");
  const [height, setHeightState] = useState(DEFAULT_HEIGHT);
  const [selections, setSelections] = useState<Record<string, DockSelection>>({});

  useEffect(() => {
    const stored = window.localStorage.getItem(HEIGHT_KEY);
    const parsed = stored ? Number.parseInt(stored, 10) : Number.NaN;
    if (Number.isFinite(parsed) && parsed >= MIN_HEIGHT) setHeightState(parsed);
  }, []);

  const setHeight = useCallback((next: number) => {
    const clamped = Math.max(MIN_HEIGHT, Math.round(next));
    setHeightState(clamped);
    window.localStorage.setItem(HEIGHT_KEY, String(clamped));
  }, []);

  const select = useCallback(
    (selection: DockSelection) => {
      if (!channel) return;
      setSelections((current) => ({ ...current, [channel.projectId]: selection }));
    },
    [channel],
  );

  const toggle = useCallback(() => {
    setMode((current) => (current === "closed" ? "open" : "closed"));
  }, []);

  useEffect(() => {
    if (!channel) setMode("closed");
  }, [channel]);

  const value = useMemo<DockValue>(
    () => ({
      channel,
      setChannel,
      mode,
      setMode,
      toggle,
      selection: channel ? (selections[channel.projectId] ?? null) : null,
      select,
      height,
      setHeight,
    }),
    [channel, mode, toggle, selections, select, height, setHeight],
  );

  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

export function useDock(): DockValue {
  const value = useContext(DockContext);
  if (!value) throw new Error("useDock must be used inside a DockProvider");
  return value;
}

export function DockChannelBinding(props: DockChannel) {
  const { setChannel } = useDock();
  const { orgSlug, channelSlug, projectId } = props;

  useEffect(() => {
    setChannel({ orgSlug, channelSlug, projectId });
    return () => setChannel(null);
  }, [setChannel, orgSlug, channelSlug, projectId]);

  return null;
}

"use client";

import { useCallback, useMemo, useRef } from "react";
import type { VirtuosoHandle } from "react-virtuoso";

export interface TailFollowOptions {
  onReachTop?: () => void;
}

export interface TailFollow {
  listRef: React.RefObject<VirtuosoHandle | null>;
  attachScroller: (element: HTMLElement | Window | null) => void;
  atBottomChanged: (isAtBottom: boolean) => void;
  atTopChanged: (isAtTop: boolean) => void;
  reachedTop: () => void;
  heightChanged: () => void;
  following: () => boolean;
  restingAtTop: () => boolean;
  stick: () => void;
  followTail: () => void;
}

const READER_EVENTS = ["wheel", "touchmove", "keydown", "mousedown"] as const;

const BOTTOM_SLACK = 80;

export function useTailFollow(options: TailFollowOptions = {}): TailFollow {
  const { onReachTop } = options;

  const listRef = useRef<VirtuosoHandle>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const detachRef = useRef<(() => void) | undefined>(undefined);

  const readerDriving = useRef(false);
  const followingTail = useRef(true);
  const atTop = useRef(false);

  const followTail = useCallback(() => {
    listRef.current?.scrollToIndex({ index: "LAST", align: "end" });
    const clampPastFooter = () => {
      const scroller = scrollerRef.current;
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    };
    clampPastFooter();
    requestAnimationFrame(clampPastFooter);
  }, []);

  const attachScroller = useCallback((element: HTMLElement | Window | null) => {
    const scroller = element instanceof HTMLElement ? element : null;
    if (scroller === scrollerRef.current) return;

    detachRef.current?.();
    detachRef.current = undefined;
    scrollerRef.current = scroller;
    if (!scroller) return;

    const takeOver = () => {
      readerDriving.current = true;
    };
    for (const name of READER_EVENTS) {
      scroller.addEventListener(name, takeOver, { passive: true });
    }
    detachRef.current = () => {
      for (const name of READER_EVENTS) {
        scroller.removeEventListener(name, takeOver);
      }
    };
  }, []);

  const atBottomChanged = useCallback((isAtBottom: boolean) => {
    if (isAtBottom) {
      followingTail.current = true;
      return;
    }
    if (!readerDriving.current) return;

    const scroller = scrollerRef.current;
    if (!scroller) return;
    const distance =
      scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
    if (distance > BOTTOM_SLACK) followingTail.current = false;
  }, []);

  const atTopChanged = useCallback(
    (isAtTop: boolean) => {
      atTop.current = isAtTop;
      if (isAtTop && readerDriving.current) onReachTop?.();
    },
    [onReachTop],
  );

  const reachedTop = useCallback(() => {
    if (readerDriving.current) onReachTop?.();
  }, [onReachTop]);

  const heightChanged = useCallback(() => {
    if (followingTail.current) followTail();
  }, [followTail]);

  const stick = useCallback(() => {
    followingTail.current = true;
    readerDriving.current = false;
    followTail();
  }, [followTail]);

  const following = useCallback(() => followingTail.current, []);

  const restingAtTop = useCallback(
    () => atTop.current && readerDriving.current,
    [],
  );

  return useMemo(
    () => ({
      listRef,
      attachScroller,
      atBottomChanged,
      atTopChanged,
      reachedTop,
      heightChanged,
      following,
      restingAtTop,
      stick,
      followTail,
    }),
    [
      attachScroller,
      atBottomChanged,
      atTopChanged,
      reachedTop,
      heightChanged,
      following,
      restingAtTop,
      stick,
      followTail,
    ],
  );
}

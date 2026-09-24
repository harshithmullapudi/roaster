"use client";

import { cn } from "@roster/ui";
import { type ReactNode, useEffect, useRef } from "react";

const FLASH_MS = 700;

export interface CountFlashProps {
  value: number;
  className?: string;
  children: ReactNode;
}

/*
 * Only a rise is worth a glance. A count falling means a session finished on
 * its own, which is the one thing nobody needs pulled out of the corner of
 * their eye — so it lands silently.
 */
export function CountFlash({ value, className, children }: CountFlashProps) {
  const element = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);

  useEffect(() => {
    const rose = value > previous.current;
    previous.current = value;

    const node = element.current;
    if (!rose || !node) return;

    node.classList.remove("count-flash-rising");
    void node.offsetWidth;
    node.classList.add("count-flash-rising");

    const timer = setTimeout(
      () => node.classList.remove("count-flash-rising"),
      FLASH_MS,
    );
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <span ref={element} className={cn("count-flash", className)}>
      {children}
    </span>
  );
}

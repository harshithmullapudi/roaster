"use client";

import { Button, Sheet, SheetContent, SheetTitle, SheetTrigger } from "@roster/ui";
import { PanelLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export function SidebarSheet({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="-ml-1 size-8 shrink-0 !rounded-md px-0 md:hidden"
          aria-label="Open navigation"
        >
          <PanelLeft size={18} />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="bg-background pb-safe flex w-[min(19rem,82vw)] max-w-none flex-col p-0 sm:max-w-none [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}

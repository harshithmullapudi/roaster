import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
}

export function PageHeader({ title, actions, tabs }: PageHeaderProps) {
  return (
    <header className="relative flex shrink-0 flex-col border-b border-gray-300 transition-[width,height] ease-linear">
      <div className="h-(--header-height) flex items-center gap-2">
        <div className="flex w-full items-center justify-between gap-1 px-4 pr-2 lg:gap-2">
          <h1 className="min-w-0 truncate text-base">{title}</h1>
          <div className="flex items-center gap-1">{actions}</div>
        </div>
      </div>
      {tabs ? <div className="px-3 pb-1.5">{tabs}</div> : null}
    </header>
  );
}

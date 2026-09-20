import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  nav?: ReactNode;
  inbox?: ReactNode;
}

export function PageHeader({
  title,
  actions,
  tabs,
  nav,
  inbox,
}: PageHeaderProps) {
  return (
    <header className="pt-safe relative flex shrink-0 flex-col border-b border-gray-300 transition-[width,height] ease-linear">
      <div className="h-(--header-height) flex items-center gap-2">
        <div className="flex w-full items-center justify-between gap-1 px-2 sm:px-4 sm:pr-2 lg:gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {nav}
            <h1 className="min-w-0 truncate text-base">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            {inbox}
          </div>
        </div>
      </div>
      {tabs ? (
        <div className="no-scrollbar overflow-x-auto px-2 pb-1.5 sm:px-3">
          {tabs}
        </div>
      ) : null}
    </header>
  );
}

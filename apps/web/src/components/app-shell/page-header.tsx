import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <header className="flex h-9 shrink-0 items-center justify-between px-3">
      <span className="text-base">{title}</span>
      {actions}
    </header>
  );
}

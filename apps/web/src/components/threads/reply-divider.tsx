import { replyCountLabel } from "~/utils/thread-rows";

export interface ReplyDividerProps {
  count: number;
}

export function ReplyDivider({ count }: ReplyDividerProps) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-1 sm:px-5">
      <span className="text-muted-foreground shrink-0 text-xs">
        {replyCountLabel(count)}
      </span>
      <span className="bg-border h-px flex-1" />
    </div>
  );
}

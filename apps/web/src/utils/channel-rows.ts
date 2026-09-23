export interface RowMessage {
  id: string;
  createdAt: Date;
}

export interface RowThread {
  id: string;
  status: string;
  completedAt: Date | null;
}

export interface MessageRowItem<M extends RowMessage> {
  kind: "message";
  message: M;
}

export interface BandRowItem {
  kind: "band";
  id: string;
  messageIds: string[];
  lastAt: Date;
  expanded: boolean;
}

export type ChannelRow<M extends RowMessage> = MessageRowItem<M> | BandRowItem;

export interface BuildChannelRowsOptions {
  collapse: boolean;
  expanded: ReadonlySet<string>;
}

export function isFoldable(thread: RowThread | undefined): boolean {
  return thread !== undefined && thread.completedAt !== null;
}

export function bandLabel(count: number): string {
  return count === 1
    ? "1 completed conversation"
    : `${count} completed conversations`;
}

export function buildChannelRows<M extends RowMessage>(
  messages: M[],
  threadsByRootMessage: ReadonlyMap<string, RowThread>,
  { collapse, expanded }: BuildChannelRowsOptions,
): ChannelRow<M>[] {
  if (!collapse) {
    return messages.map((message) => ({ kind: "message", message }));
  }

  const built: ChannelRow<M>[] = [];
  let index = 0;

  while (index < messages.length) {
    const start = messages[index];
    if (!start || !isFoldable(threadsByRootMessage.get(start.id))) {
      if (start) built.push({ kind: "message", message: start });
      index += 1;
      continue;
    }

    let end = index;
    while (end + 1 < messages.length) {
      const next = messages[end + 1];
      if (!next || !isFoldable(threadsByRootMessage.get(next.id))) break;
      end += 1;
    }

    const run = messages.slice(index, end + 1);
    const last = run[run.length - 1];
    const open = expanded.has(start.id);

    built.push({
      kind: "band",
      id: start.id,
      messageIds: run.map((message) => message.id),
      lastAt: last ? last.createdAt : start.createdAt,
      expanded: open,
    });

    if (open) {
      for (const message of run) built.push({ kind: "message", message });
    }

    index = end + 1;
  }

  return built;
}

export function anchorRowIndex<M extends RowMessage>(
  rows: ChannelRow<M>[],
  anchorId: string | undefined,
): number | null {
  if (!anchorId) return null;

  const found = rows.findIndex((row) =>
    row.kind === "band"
      ? row.messageIds.includes(anchorId)
      : row.message.id === anchorId,
  );
  return found === -1 ? null : found;
}

export function rowKey<M extends RowMessage>(
  row: ChannelRow<M>,
  messageKey: (message: M) => string,
): string {
  return row.kind === "band" ? `band:${row.id}` : messageKey(row.message);
}

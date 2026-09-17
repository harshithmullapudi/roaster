export const RUN_WINDOW_MS = 5 * 60 * 1000;

export interface RunMessage {
  id: string;
  authorMemberId: string | null;
  createdAt: Date;
  threadId: string | null;
  text: string;
}

export function contiguousRun<T extends RunMessage>(args: {
  newest: T;
  earlier: T[];
  windowMs?: number;
}): T[] {
  const windowMs = args.windowMs ?? RUN_WINDOW_MS;
  const cutoff = args.newest.createdAt.getTime() - windowMs;
  const run: T[] = [args.newest];

  for (const message of args.earlier) {
    if (message.id === args.newest.id) continue;
    if (message.authorMemberId !== args.newest.authorMemberId) break;
    if (message.threadId !== null) break;
    if (message.createdAt.getTime() < cutoff) break;
    run.unshift(message);
  }

  return run;
}

export function sessionPrompt(args: {
  context: string[];
  request: string;
}): string {
  const earlier = args.context
    .map((text) => text.trim())
    .filter((text) => text.length > 0);

  if (earlier.length === 0) return args.request;

  const lines = earlier.map((text) => `- ${text}`).join("\n");
  return `Earlier in the channel:\n${lines}\n\nRequest:\n${args.request}`;
}

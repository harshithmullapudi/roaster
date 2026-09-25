import type { MentionItem } from "./mentions";
import { trpc } from "./trpc";

let items: MentionItem[] = [];
let loaded = false;
let inflight: Promise<MentionItem[]> | null = null;
const subscribers = new Set<() => void>();

export function knownMentions(): MentionItem[] {
  return items;
}

export function subscribeMentions(listener: () => void): () => void {
  subscribers.add(listener);
  void loadMentions();
  return () => subscribers.delete(listener);
}

export function loadMentions(): Promise<MentionItem[]> {
  if (loaded) return Promise.resolve(items);
  if (inflight) return inflight;

  inflight = trpc.channels.mentionable
    .query()
    .then((result) => {
      items = result;
      loaded = true;
      for (const listener of subscribers) listener();
      return items;
    })
    .catch(() => [])
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function forgetMentions(): void {
  loaded = false;
  items = [];
}

export function handlesByLength(): MentionItem[] {
  return [...items].sort(
    (a, b) =>
      b.handle.length - a.handle.length ||
      Number(a.kind === "member") - Number(b.kind === "member"),
  );
}

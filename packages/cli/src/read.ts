import { flagString, type ParsedArgs } from "./args.js";

export interface ThreadMarker {
  id: string;
  replyCount: number;
}

export interface ReadMessage {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  thread?: ThreadMarker | null;
}

export interface ChannelPage {
  channel: { slug: string };
  messages: ReadMessage[];
}

export interface ThreadPage {
  channel: { slug: string };
  thread: { id: string; status: string; replyCount: number };
  messages: ReadMessage[];
}

export type ReadTarget =
  | { ok: true; kind: "channel" | "thread"; id: string }
  | { ok: false; message: string };

export function readTarget(parsed: ParsedArgs): ReadTarget {
  const channelId = flagString(parsed, "channel-id");
  const threadId = flagString(parsed, "thread-id");

  if (channelId && threadId) {
    return {
      ok: false,
      message:
        "Pass either --channel-id or --thread-id, not both. A channel read lists what was said out loud; a thread read follows one of those messages down.",
    };
  }

  if (channelId) return { ok: true, kind: "channel", id: channelId };
  if (threadId) return { ok: true, kind: "thread", id: threadId };

  return {
    ok: false,
    message:
      "Pass --channel-id to read a channel, or --thread-id to read one thread. Both ids are in the <roster> block at the top of your session, and a channel read prints the thread ids it finds.",
  };
}

function replies(count: number): string {
  if (count === 0) return "no replies yet";
  return count === 1 ? "1 reply" : `${count} replies`;
}

function messageBlock(message: ReadMessage): string {
  return `[${message.createdAt}] ${message.author} · ${message.id}:\n${message.text}`;
}

export function formatChannel(page: ChannelPage): string {
  if (page.messages.length === 0) {
    return `# ${page.channel.slug}\n\nNo messages yet.`;
  }

  const blocks = page.messages.map((message) => {
    const marker = message.thread
      ? `\n  ↳ thread ${message.thread.id} · ${replies(message.thread.replyCount)}`
      : "";
    return `${messageBlock(message)}${marker}`;
  });

  return [`# ${page.channel.slug}`, ...blocks].join("\n\n");
}

export function formatThread(page: ThreadPage): string {
  const header = `# ${page.channel.slug} · thread ${page.thread.id} · ${page.thread.status} · ${replies(page.thread.replyCount)}`;

  if (page.messages.length === 0) return header;

  return [header, ...page.messages.map(messageBlock)].join("\n\n");
}

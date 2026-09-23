import { TRPCError } from "@trpc/server";
import { Queue, QueueEvents } from "bullmq";

import { redis } from "../../lib/redis";

export const SESSION_QUEUE = "roster-sessions";

export const REPLY_TIMEOUT_MS = 15_000;

export interface SessionCommands {
  startSession: {
    threadId: string;
    text: string;
    context?: string[];
    delegation?: {
      askedBy: string;
      originChannelId: string;
    };
  };
  steer: { threadId: string; text: string };
  cancelThread: { threadId: string };
  retryThread: { threadId: string };
  reapThread: { threadId: string };
}

export type SessionCommand = keyof SessionCommands;

let queue: Queue | null = null;
let events: QueueEvents | null = null;

export function sessionQueue(): Queue {
  if (!queue) {
    queue = new Queue(SESSION_QUEUE, { connection: redis("producer") });
    queue.on("error", (cause) => {
      console.warn(`[sessions] queue error: ${cause.message}`);
    });
  }
  return queue;
}

function sessionEvents(): QueueEvents {
  if (!events) {
    events = new QueueEvents(SESSION_QUEUE, { connection: redis("subscriber") });
    events.on("error", (cause) => {
      console.warn(`[sessions] queue events error: ${cause.message}`);
    });
  }
  return events;
}

export async function tell<C extends SessionCommand>(
  command: C,
  args: SessionCommands[C],
): Promise<void> {
  await sessionQueue().add(command, args, {
    removeOnComplete: 1000,
    removeOnFail: 5000,
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  });
}

const NO_WORKER =
  "No worker picked that up in time. Roster's background service may be " +
  "down or still starting — the session was left as it was.";

function timedOut(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause);
  return message.includes("timed out") || message.includes("Timed out");
}

export async function ask<C extends SessionCommand, T>(
  command: C,
  args: SessionCommands[C],
): Promise<T> {
  const job = await sessionQueue().add(command, args, {
    removeOnComplete: 1000,
    removeOnFail: 5000,
    attempts: 1,
  });

  try {
    return (await job.waitUntilFinished(sessionEvents(), REPLY_TIMEOUT_MS)) as T;
  } catch (cause) {
    if (timedOut(cause)) {
      await job.remove().catch(() => {});
      throw new TRPCError({ code: "TIMEOUT", message: NO_WORKER });
    }
    throw cause;
  }
}

export async function closeSessionQueue(): Promise<void> {
  const open = [queue, events];
  queue = null;
  events = null;

  for (const handle of open) {
    if (handle) await handle.close();
  }
}

import { TRPCError } from "@trpc/server";
import { type Job, Queue, QueueEvents } from "bullmq";

import { redis } from "../../lib/redis";

export const SESSION_QUEUE = "roster-sessions";

/**
 * Every one of these reaches the member's own machine through the relay —
 * minting a JWT, then one or more round trips to a laptop that may be asleep,
 * on a bad network, or gone. The supervisor gives those its own retries, so
 * the budget here has to outlast them rather than race them.
 */
export const REPLY_TIMEOUT_MS: Record<SessionCommand, number> = {
  startSession: 30_000,
  steer: 30_000,
  cancelThread: 45_000,
  retryThread: 45_000,
  reapThread: 90_000,
};

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

function timedOut(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause);
  return message.toLowerCase().includes("timed out");
}

const STILL_RUNNING =
  "That machine is taking longer than expected. Roster is still working on " +
  "it — give it a moment and reload before trying again.";

const NOT_PICKED_UP =
  "Roster's background service did not pick that up. It may be down or " +
  "restarting; the session was left as it was.";

async function timeoutError(job: Job): Promise<TRPCError> {
  const state = await job.getState().catch(() => "unknown");

  if (state === "active") {
    return new TRPCError({ code: "TIMEOUT", message: STILL_RUNNING });
  }

  if (state === "waiting" || state === "delayed" || state === "prioritized") {
    await job.remove().catch(() => {});
    return new TRPCError({ code: "TIMEOUT", message: NOT_PICKED_UP });
  }

  return new TRPCError({ code: "TIMEOUT", message: STILL_RUNNING });
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
    return (await job.waitUntilFinished(
      sessionEvents(),
      REPLY_TIMEOUT_MS[command],
    )) as T;
  } catch (cause) {
    if (timedOut(cause)) throw await timeoutError(job);
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

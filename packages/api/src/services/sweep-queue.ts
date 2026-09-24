import { Queue } from "bullmq";

import { redis } from "../lib/redis";

export const SWEEP_QUEUE = "roster-schedules";
export const SWEEP_JOB = "sweep";
export const SWEEP_SCHEDULER_ID = "schedules:sweep";
export const SWEEP_INTERVAL_MS = 60_000;

let queue: Queue | null = null;

export function sweepQueue(): Queue {
  if (!queue) {
    queue = new Queue(SWEEP_QUEUE, { connection: redis("producer") });
    queue.on("error", (cause) => {
      console.warn(`[recurrence] queue error: ${cause.message}`);
    });
  }
  return queue;
}

export async function ensureSweepScheduled(): Promise<void> {
  await sweepQueue().upsertJobScheduler(
    SWEEP_SCHEDULER_ID,
    { every: SWEEP_INTERVAL_MS },
    {
      name: SWEEP_JOB,
      opts: { removeOnComplete: 100, removeOnFail: 500 },
    },
  );
}

export async function closeSweepQueue(): Promise<void> {
  const open = queue;
  queue = null;
  if (open) await open.close();
}

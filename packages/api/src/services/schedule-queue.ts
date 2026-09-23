import { Queue } from "bullmq";

import { redis } from "../lib/redis";

export const SCHEDULE_QUEUE = "roster-schedules";
export const SWEEP_JOB = "sweep";
export const SWEEP_SCHEDULER_ID = "schedules:sweep";
export const SWEEP_INTERVAL_MS = 60_000;

let queue: Queue | null = null;

export function scheduleQueue(): Queue {
  if (!queue) {
    queue = new Queue(SCHEDULE_QUEUE, { connection: redis("producer") });
    queue.on("error", (cause) => {
      console.warn(`[schedules] queue error: ${cause.message}`);
    });
  }
  return queue;
}

export async function ensureSweepScheduled(): Promise<void> {
  await scheduleQueue().upsertJobScheduler(
    SWEEP_SCHEDULER_ID,
    { every: SWEEP_INTERVAL_MS },
    {
      name: SWEEP_JOB,
      opts: { removeOnComplete: 100, removeOnFail: 500 },
    },
  );
}

export async function closeScheduleQueue(): Promise<void> {
  const open = queue;
  queue = null;
  if (open) await open.close();
}

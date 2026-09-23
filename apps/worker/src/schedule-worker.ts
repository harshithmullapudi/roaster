import { redis } from "@roster/api/redis";
import {
  ensureSweepScheduled,
  SCHEDULE_QUEUE,
  sweepSchedules,
} from "@roster/api/schedules";
import { Worker } from "bullmq";

const LOCK_DURATION_MS = 120_000;

export async function scheduleWorker(): Promise<Worker> {
  const worker = new Worker(
    SCHEDULE_QUEUE,
    async () => {
      const summary = await sweepSchedules();

      if (summary.fired > 0 || summary.skipped > 0) {
        console.log(
          `[schedules] ${summary.fired} fired, ${summary.skipped} skipped of ${summary.considered} due`,
        );
      }

      return summary;
    },
    {
      connection: redis("worker"),
      concurrency: 1,
      lockDuration: LOCK_DURATION_MS,
    },
  );

  worker.on("failed", (_job, cause) => {
    console.warn(`[schedules] sweep failed: ${cause.message}`);
  });

  worker.on("error", (cause) => {
    console.warn(`[schedules] worker error: ${cause.message}`);
  });

  await worker.waitUntilReady();
  await ensureSweepScheduled();

  return worker;
}

import { redis } from "@roster/api/redis";
import {
  ensureSweepScheduled,
  SWEEP_QUEUE,
  sweepTasks,
} from "@roster/api/recurrence";
import { Worker } from "bullmq";

const LOCK_DURATION_MS = 120_000;

export async function sweepWorker(): Promise<Worker> {
  const worker = new Worker(
    SWEEP_QUEUE,
    async () => {
      const summary = await sweepTasks();

      if (summary.fired > 0 || summary.skipped > 0) {
        console.log(
          `[recurrence] ${summary.fired} fired, ${summary.skipped} skipped of ${summary.considered} due`,
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
    console.warn(`[recurrence] sweep failed: ${cause.message}`);
  });

  worker.on("error", (cause) => {
    console.warn(`[recurrence] worker error: ${cause.message}`);
  });

  await worker.waitUntilReady();
  await ensureSweepScheduled();

  return worker;
}

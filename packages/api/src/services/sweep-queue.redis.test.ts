import { Worker } from "bullmq";
import { afterAll, describe, expect, it } from "vitest";

import { hasRedis, redis } from "../lib/redis";

import {
  closeSweepQueue,
  ensureSweepScheduled,
  SWEEP_QUEUE,
  sweepQueue,
  SWEEP_INTERVAL_MS,
  SWEEP_SCHEDULER_ID,
} from "./sweep-queue";

let worker: Worker | null = null;

afterAll(async () => {
  if (worker) await worker.close();
  if (hasRedis()) {
    await sweepQueue().removeJobScheduler(SWEEP_SCHEDULER_ID).catch(() => false);
    await sweepQueue().obliterate({ force: true });
  }
  await closeSweepQueue();
});

describe.skipIf(!hasRedis())("the sweep scheduler", () => {
  it("registers one scheduler, however often it is upserted", async () => {
    await ensureSweepScheduled();
    await ensureSweepScheduled();
    await ensureSweepScheduled();

    const schedulers = await sweepQueue().getJobSchedulers();
    const ours = schedulers.filter((row) => row.key === SWEEP_SCHEDULER_ID);

    expect(ours).toHaveLength(1);
    expect(Number(ours[0]!.every)).toBe(SWEEP_INTERVAL_MS);
  });

  it("hands the sweep to a worker", async () => {
    const ran: string[] = [];

    worker = new Worker(
      SWEEP_QUEUE,
      async (job) => {
        ran.push(job.name);
      },
      { connection: redis("worker"), concurrency: 1 },
    );
    await worker.waitUntilReady();

    await ensureSweepScheduled();

    for (let attempt = 0; attempt < 50 && ran.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(ran.length).toBeGreaterThan(0);
  });
});

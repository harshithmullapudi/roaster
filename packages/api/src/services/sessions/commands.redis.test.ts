import { Worker } from "bullmq";
import { afterAll, describe, expect, it } from "vitest";

import { createRedis, hasRedis } from "../../lib/redis";

import {
  ask,
  closeSessionQueue,
  SESSION_QUEUE,
  sessionQueue,
  tell,
} from "./commands";

const seen: Array<{ name: string; data: unknown }> = [];

let worker: Worker | null = null;

async function startWorker(): Promise<void> {
  worker = new Worker(
    SESSION_QUEUE,
    async (job) => {
      seen.push({ name: job.name, data: job.data });
      if (job.name === "cancelThread") return true;
      if (job.name === "retryThread") throw new Error("nothing to retry");
      return undefined;
    },
    { connection: createRedis("worker"), concurrency: 4 },
  );
  await worker.waitUntilReady();
}

async function waitFor(check: () => boolean, ms = 8000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

afterAll(async () => {
  if (worker) await worker.close();
  if (hasRedis()) await sessionQueue().obliterate({ force: true });
  await closeSessionQueue();
});

describe.skipIf(!hasRedis())("the session command queue", () => {
  it("carries a fire-and-forget command to the worker", async () => {
    await startWorker();

    await tell("steer", { threadId: "thread-1", text: "look again" });

    await waitFor(() => seen.some((job) => job.name === "steer"));

    const steered = seen.find((job) => job.name === "steer");
    expect(steered?.data).toEqual({ threadId: "thread-1", text: "look again" });
  });

  it("returns the worker's answer for a command that has one", async () => {
    expect(await ask("cancelThread", { threadId: "thread-2" })).toBe(true);
  });

  it("surfaces a failure rather than reporting success", async () => {
    await expect(ask("retryThread", { threadId: "thread-3" })).rejects.toThrow(
      "nothing to retry",
    );
  });

  it("says so plainly when no worker answers", async () => {
    if (worker) {
      await worker.close();
      worker = null;
    }

    await expect(
      ask("cancelThread", { threadId: "thread-4" }),
    ).rejects.toThrow(/No worker picked that up/);
  }, 30_000);
});

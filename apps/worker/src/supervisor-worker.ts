import { redis } from "@roster/api/redis";
import { SESSION_QUEUE, type SessionCommands } from "@roster/api/sessions";
import { type Job, Worker } from "bullmq";

type Handlers = {
  [C in keyof SessionCommands]: (args: SessionCommands[C]) => Promise<unknown>;
};

const CONCURRENCY = 8;
const LOCK_DURATION_MS = 60_000;

export async function supervisorWorker(handlers: Handlers): Promise<Worker> {
  const worker = new Worker(
    SESSION_QUEUE,
    async (job: Job) => {
      const handler = handlers[job.name as keyof Handlers];
      if (!handler) {
        throw new Error(`No handler for session command "${job.name}"`);
      }
      return handler(job.data);
    },
    {
      connection: redis("worker"),
      concurrency: CONCURRENCY,
      lockDuration: LOCK_DURATION_MS,
    },
  );

  worker.on("failed", (job, cause) => {
    console.warn(
      `[worker] ${job?.name ?? "job"} ${job?.id ?? ""} failed: ${cause.message}`,
    );
  });

  worker.on("error", (cause) => {
    console.warn(`[worker] queue error: ${cause.message}`);
  });

  await worker.waitUntilReady();

  return worker;
}

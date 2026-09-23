import { spawn } from "node:child_process";

const children = new Map();
let shuttingDown = false;

function start(name, args) {
  const child = spawn(process.execPath, args, { stdio: "inherit" });
  children.set(name, child);

  child.on("exit", (code, signal) => {
    children.delete(name);
    if (shuttingDown) return;

    console.error(
      `[start] ${name} exited (${signal ?? `code ${code}`}) — stopping the container`,
    );
    stop(signal ? 1 : (code ?? 1));
  });

  return child;
}

function stop(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children.values()) {
    child.kill("SIGTERM");
  }

  const deadline = setTimeout(() => {
    for (const child of children.values()) child.kill("SIGKILL");
    process.exit(code);
  }, 15_000);

  const wait = setInterval(() => {
    if (children.size > 0) return;
    clearInterval(wait);
    clearTimeout(deadline);
    process.exit(code);
  }, 100);
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => stop(0));
}

// A template deploy asks a person to type this, so accept what a person
// would reasonably type rather than one exact string. Getting it wrong is
// silent and severe: the app comes up and no agent session ever runs.
function wantsWorker() {
  const raw = (process.env.ROSTER_RUN_WORKER ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

start("web", ["apps/web/server.js"]);

if (wantsWorker()) {
  console.log(
    "[start] ROSTER_RUN_WORKER is set — running the worker in this container too",
  );
  start("worker", ["apps/worker/dist/worker.mjs"]);
} else {
  console.warn(
    "[start] ROSTER_RUN_WORKER is not set. No agent session will run in this " +
      "container — something else must run the worker, or set it to 1.",
  );
}

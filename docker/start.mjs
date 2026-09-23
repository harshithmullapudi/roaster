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

start("web", ["apps/web/server.js"]);

if (process.env.ROSTER_RUN_WORKER === "1") {
  console.log("[start] ROSTER_RUN_WORKER=1 — running the worker in this container too");
  start("worker", ["apps/worker/dist/worker.js"]);
}

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const REPO = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const ORIGIN = "http://localhost:3000";
const PORT = 3000;
const INITIAL_PAGE = 50;

const options = {
  email: arg("--email", "born4rhell@gmail.com"),
  channel: arg("--channel", "/superset/scrollbench"),
  projectId: arg("--project", "dddddddd-0000-4000-8000-00000000beef"),
  burst: Number(arg("--burst", "400")),
  bursts: Number(arg("--bursts", "6")),
  rate: Number(arg("--rate", "25")),
  keepServer: process.argv.includes("--keep-server"),
  prod: process.argv.includes("--prod"),
  profile: process.argv.includes("--profile"),
};

function arg(flag, fallback) {
  const at = process.argv.indexOf(flag);
  return at === -1 ? fallback : process.argv[at + 1];
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function centrifugoCredentials() {
  const raw = execFileSync("docker", [
    "inspect",
    "roster-centrifugo",
    "--format",
    "{{range .Config.Env}}{{println .}}{{end}}",
  ]).toString();

  const read = (name) =>
    raw.split("\n").find((line) => line.startsWith(`${name}=`))?.slice(name.length + 1);

  const secret = read("CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY");
  const apiKey = read("CENTRIFUGO_HTTP_API_KEY");
  if (!secret || !apiKey) {
    throw new Error(
      "roster-centrifugo is not running, or has no token secret. Start it with docker compose -f docker-compose.dev.yaml up -d",
    );
  }
  return { secret, apiKey, url: "http://localhost:8010" };
}

function chromiumPath() {
  const root = join(process.env.HOME, "Library/Caches/ms-playwright");
  const builds = execFileSync("ls", [root])
    .toString()
    .split("\n")
    .filter((name) => name.startsWith("chromium-"))
    .sort();

  for (const build of builds.reverse()) {
    for (const flavour of ["chrome-mac-arm64", "chrome-mac"]) {
      for (const app of ["Google Chrome for Testing", "Chromium"]) {
        const candidate = join(root, build, flavour, `${app}.app/Contents/MacOS/${app}`);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  throw new Error("no playwright chromium found — run: npx playwright install chromium");
}

async function startServer(centrifugo, logPath) {
  const env = {
    ...process.env,
    CENTRIFUGO_URL: centrifugo.url,
    CENTRIFUGO_PUBLIC_URL: centrifugo.url,
    CENTRIFUGO_API_KEY: centrifugo.apiKey,
    CENTRIFUGO_TOKEN_HMAC_SECRET: centrifugo.secret,
  };

  if (options.prod) {
    console.log("building apps/web for production, this takes a few minutes");
    execFileSync("npx", ["next", "build"], {
      cwd: join(REPO, "apps/web"),
      env: { ...env, NEXT_DIST_DIR: ".next-build" },
      stdio: "inherit",
    });
  }

  const log = spawn(
    "npx",
    options.prod
      ? ["next", "start", "--port", String(PORT)]
      : ["next", "dev", "--port", String(PORT)],
    {
      cwd: join(REPO, "apps/web"),
      env: options.prod ? { ...env, NEXT_DIST_DIR: ".next-build" } : env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const { createWriteStream } = await import("node:fs");
  const sink = createWriteStream(logPath);
  log.stdout.pipe(sink);
  log.stderr.pipe(sink);

  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(1000);
    try {
      const response = await fetch(`${ORIGIN}/sign-in`, { redirect: "manual" });
      if (response.status < 500) return log;
    } catch {}
  }
  throw new Error(`the ${options.prod ? "production" : "dev"} server never came up on :${PORT}`);
}

async function warm(paths) {
  for (const path of paths) {
    execFileSync("curl", ["-s", "-o", "/dev/null", "--max-time", "180", `${ORIGIN}${path}`]);
  }
}

async function signIn(logPath) {
  const tokensIn = (text) => [...text.matchAll(/verify\?token=[^\s"]+/g)].map((m) => m[0]);
  const before = tokensIn(readFileSync(logPath, "utf8"));
  const last = before[before.length - 1];

  execFileSync("curl", [
    "-s", "-X", "POST", `${ORIGIN}/api/auth/sign-in/magic-link`,
    "-H", "Content-Type: application/json",
    "-d", JSON.stringify({ email: options.email }),
  ]);

  for (let attempt = 0; attempt < 90; attempt += 1) {
    await sleep(500);
    const all = tokensIn(readFileSync(logPath, "utf8"));
    const fresh = all[all.length - 1];
    if (fresh && fresh !== last) return sessionCookie(fresh);
  }
  throw new Error("no magic link appeared in the dev server log");
}

function sessionCookie(link) {
  const headers = execFileSync("curl", [
    "-s", "-o", "/dev/null", "-D", "-",
    `${ORIGIN}/api/auth/magic-link/${link}`,
  ]).toString();

  const value = headers
    .split("\n")
    .filter((line) => line.toLowerCase().startsWith("set-cookie:"))
    .map((line) => line.match(/better-auth\.session_token=([^;]+)/)?.[1])
    .find(Boolean);

  if (!value) throw new Error("redeeming the magic link returned no session cookie");
  return decodeURIComponent(value);
}

const installRecorder = () => {
  const frames = {
    gaps: [],
    longTasks: 0,
    longTaskMs: 0,
    sockets: 0,
    socketUrls: [],
    delivered: 0,
  };
  let previous = performance.now();

  const NativeSocket = window.WebSocket;
  const CountingSocket = function (...args) {
    frames.sockets += 1;
    frames.socketUrls.push(String(args[0]));
    const socket = new NativeSocket(...args);
    socket.addEventListener("message", (event) => {
      if (typeof event.data === "string" && event.data.includes("repro message")) {
        frames.delivered += 1;
      }
    });
    return socket;
  };
  CountingSocket.prototype = NativeSocket.prototype;
  for (const state of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) {
    CountingSocket[state] = NativeSocket[state];
  }
  window.WebSocket = CountingSocket;

  const tick = () => {
    const now = performance.now();
    frames.gaps.push(now - previous);
    previous = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        frames.longTasks += 1;
        frames.longTaskMs += entry.duration;
      }
    }).observe({ entryTypes: ["longtask"] });
  } catch {}

  window.__frames = frames;
  window.__resetFrames = () => {
    frames.gaps.length = 0;
    frames.longTasks = 0;
    frames.longTaskMs = 0;
    previous = performance.now();
  };
};

const readRecorder = () => {
  const { gaps, longTasks, longTaskMs, delivered } = window.__frames;
  const janky = gaps.filter((gap) => gap > 50);
  const blocked = janky.reduce((total, gap) => total + (gap - 16.7), 0);
  return {
    worstFrameMs: Math.round(Math.max(0, ...gaps) * 10) / 10,
    jankyFrames: janky.length,
    blockedMs: Math.round(blocked),
    longTasks,
    longTaskMs: Math.round(longTaskMs),
    delivered,
  };
};

function syntheticMessage(projectId, seq) {
  return {
    type: "message",
    message: {
      id: `repro-${seq}`,
      projectId,
      seq,
      kind: "user",
      agentChannelId: null,
      agentDisplay: null,
      agentHandle: null,
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: `repro message ${seq}` }],
          },
        ],
      },
      text: `repro message ${seq} — filler so the row has a realistic height`,
      clientId: null,
      parentMessageId: null,
      threadId: null,
      createdAt: new Date(Date.UTC(2030, 0, 1) + seq * 1000).toISOString(),
      editedAt: null,
      authorMemberId: null,
      authorName: "Repro Bot",
      authorEmail: "repro@example.test",
      attachments: [],
      reactions: [],
    },
  };
}

function topFrames(profile, limit = 25) {
  const byFrame = new Map();

  for (const node of profile.nodes) {
    if (!node.hitCount) continue;
    const { functionName, url, lineNumber } = node.callFrame;
    const where = url ? `${url.split("/").pop()}:${lineNumber + 1}` : "native";
    const key = `${functionName || "(anonymous)"}  ${where}`;
    byFrame.set(key, (byFrame.get(key) ?? 0) + node.hitCount);
  }

  const totalHits = [...byFrame.values()].reduce((sum, hits) => sum + hits, 0);
  const wallMs = (profile.endTime - profile.startTime) / 1000;

  return [...byFrame]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([frame, hits]) => ({
      frame,
      selfMs: Math.round((hits / totalHits) * wallMs),
      share: `${((hits / totalHits) * 100).toFixed(1)}%`,
    }));
}

async function publish(centrifugo, channel, data) {
  const response = await fetch(`${centrifugo.url}/api/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": centrifugo.apiKey },
    body: JSON.stringify({ channel, data }),
  });
  const payload = await response.json();
  if (payload.error) throw new Error(`centrifugo rejected publish: ${payload.error.message}`);
}

async function main() {
  const centrifugo = centrifugoCredentials();
  const logPath = join(mkdtempSync(join(tmpdir(), "roster-repro-")), "server.log");
  console.log(`server log: ${logPath}`);

  const server = await startServer(centrifugo, logPath);
  await warm(["/sign-in", options.channel]);

  const session = await signIn(logPath);
  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    args: ["--enable-precise-memory-info"],
  });

  try {
    const context = await browser.newContext();
    await context.addInitScript(installRecorder);
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: session,
        domain: "localhost",
        path: "/",
      },
    ]);
    const page = await context.newPage();
    page.on("console", (message) => {
      const text = message.text();
      if (text.includes("[realtime]") || text.includes("[messages]")) {
        console.log(`  page: ${text}`);
      }
    });
    const cdp = await context.newCDPSession(page);

    await page.goto(`${ORIGIN}${options.channel}`, {
      timeout: 180000,
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(8000);

    console.log(`landed on: ${page.url()}`);

    let socketUrls = [];
    for (let attempt = 0; attempt < 60; attempt += 1) {
      socketUrls = await page.evaluate(() => window.__frames.socketUrls);
      if (socketUrls.some((url) => url.includes("connection/websocket"))) break;
      await sleep(1000);
    }
    console.log(`sockets opened: ${socketUrls.join(" ") || "none"}`);
    if (!socketUrls.some((url) => url.includes("connection/websocket"))) {
      throw new Error(
        "the page never connected to Centrifugo after 60s — check CENTRIFUGO_* wiring",
      );
    }

    const channel = `channel:${options.projectId}`;
    const gap = Math.max(1, Math.round(1000 / options.rate));
    let retained = INITIAL_PAGE;
    let seq = 1_000_000;

    await cdp.send("Performance.enable");
    const scriptSeconds = async () => {
      const { metrics } = await cdp.send("Performance.getMetrics");
      return metrics.find((metric) => metric.name === "ScriptDuration")?.value ?? 0;
    };

    console.log("");
    console.log("retained  sent  received  script ms  per message  worst frame  blocked ms");
    console.log("--------  ----  --------  ---------  -----------  -----------  ----------");

    if (options.profile) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    }

    let deliveredSoFar = 0;
    for (let round = 1; round <= options.bursts; round += 1) {
      await cdp.send("HeapProfiler.collectGarbage");
      await page.evaluate(() => window.__resetFrames());
      if (options.profile) await cdp.send("Profiler.start");
      const before = await scriptSeconds();

      for (let sent = 0; sent < options.burst; sent += 1) {
        await publish(centrifugo, channel, syntheticMessage(options.projectId, seq));
        seq += 1;
        await sleep(gap);
      }

      await sleep(2500);
      const scriptMs = Math.round((await scriptSeconds() - before) * 1000);
      const measured = await page.evaluate(readRecorder);
      const received = measured.delivered - deliveredSoFar;
      deliveredSoFar = measured.delivered;
      retained += received;

      console.log(
        `${String(retained).padStart(8)}  ${String(options.burst).padStart(4)}  ` +
          `${String(received).padStart(8)}  ${String(scriptMs).padStart(9)}  ` +
          `${(scriptMs / Math.max(1, received)).toFixed(2).padStart(11)}  ` +
          `${String(measured.worstFrameMs).padStart(11)}  ${String(measured.blockedMs).padStart(10)}`,
      );

      if (options.profile) {
        const { profile } = await cdp.send("Profiler.stop");
        console.log(`  where that round's time went (self time, ${retained} retained):`);
        for (const { frame, selfMs, share } of topFrames(profile)) {
          console.log(`    ${String(selfMs).padStart(6)} ms  ${share.padStart(6)}  ${frame}`);
        }
        console.log("");
      }

      if (round === 1 && received === 0) {
        throw new Error(
          "the page received none of the published messages — the repro is measuring nothing. " +
            `Check that the tab is subscribed to ${channel}.`,
        );
      }
    }

    const newest = await page.evaluate(() => document.body.innerText.includes("repro message"));
    if (!newest) {
      throw new Error("published messages never reached the rendered list");
    }

    console.log("");
    console.log("Same burst, same rate, every round. Only the retained history grows.");
    if (!options.prod) {
      console.log("Dev build: treat the absolute numbers as inflated, compare the trend. Use --prod for real ones.");
    }
  } finally {
    await browser.close();
    if (!options.keepServer) server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(`\nrepro failed: ${error.message}`);
  process.exit(1);
});

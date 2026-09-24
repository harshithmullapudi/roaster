# Perf repros

## `message-lag-repro.mjs`

Reproduces "the app gets laggy the longer it runs" as a table you can run
before and after a fix.

```bash
pnpm perf:message-lag                          # quick, dev build
pnpm perf:message-lag -- --prod                # trustworthy numbers
pnpm perf:message-lag -- --prod --profile      # plus a CPU profile per round
pnpm perf:message-lag -- --burst 800 --bursts 6 --rate 40
```

### What it does

Signs in, opens a channel, then publishes synthetic messages straight to
Centrifugo's HTTP API — the same websocket path the real app receives on.
Every round sends the **same burst at the same rate**; the only thing that
changes between rounds is how much history has piled up in the client's
message cache. It reports main-thread jank per round.

Nothing is written to the database. The synthetic messages exist only in
the open tab, so a reload restores the channel and there is nothing to
clean up.

### Reading the output

```
retained  burst  worst frame  janky frames  blocked ms  long tasks
```

`retained` is how many messages the client is holding. If `blocked ms`
climbs while `burst` and `rate` stay flat, the cost of receiving a message
is a function of history size — which is the bug. A fix should keep that
column roughly level across rounds.

### Requirements

- `roster-postgres` and `roster-centrifugo` running (`pnpm dev:db`), and
  port 3000 free. The script starts and stops its own web server, reading
  the Centrifugo secrets off the running container, so realtime is on even
  if your `.env` leaves `CENTRIFUGO_*` empty.
- A member who has finished onboarding. Override with
  `--email`, `--channel` and `--project` to point at your own.
- Chromium from Playwright (`npx playwright install chromium`).

Dev-build numbers are inflated by React's development build. Use `--prod`
for anything you intend to quote — the gap is about 5x, big enough to
invent problems that do not exist.

### `--profile`

Samples the renderer at 200µs during each burst and prints the top frames
by self time. Use it to attribute a cost before changing code, not after.

### What it measured on 2026-09-24

Production build, 200 messages per round at 25/s, all received:

| retained | per message | main thread |
|---|---|---|
| 250 | 3.57 ms | 86% idle |
| 450 | 3.71 ms | 84% idle |

Receiving a message costs a few milliseconds and does not get more
expensive as history grows. The same run on a dev build reports ~18 ms per
message, which is development-mode overhead rather than a real cost.

Threads accumulate with a channel's age and nothing trims them, so they
were the other candidate. `--threads-per-round` grows them; per-message
cost does not follow:

| threads | per message |
|---|---|
| 400 | 4.15 ms |
| 1200 | 4.03 ms |
| 2000 | 4.02 ms |

Ruled out by measurement, so do not re-chase without new evidence:

- Resource leaks. Over 54 channel switches with realtime on, live
  websockets held steady, heap was flat after forced GC, DOM node count and
  interval count were flat.
- Retained history driving per-message cost. Flat from 350 to 1850
  retained on dev, and 250 to 450 on prod.
- Forced layout in the tail-follow path. `getBoundingClientRect` and
  `get offsetParent` together account for under 0.5% of self time.
- Thread accumulation, from 400 to 2000 threads in one channel.

### What this harness cannot see

It drives **Chromium**. The desktop app is a Tauri **WKWebView**, a
different engine with its own memory and compositing behaviour, so a
degradation specific to WebKit would never show up here. It also runs for
minutes, not the days of uptime a desktop window accumulates, and it drives
one channel with no terminal sessions attached.

If the app is slow in the wild and this harness says it is healthy, trust
the app and suspect one of those gaps.

The channel message cache really is unbounded — nothing trims it, which
`message-cache-growth.test.ts` pins — but that is a memory question, not
the reason the app would feel heavier over time.

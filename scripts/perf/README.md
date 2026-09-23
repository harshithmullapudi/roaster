# Perf repros

## `message-lag-repro.mjs`

Reproduces "the app gets laggy the longer it runs" as a table you can run
before and after a fix.

```bash
pnpm perf:message-lag                          # quick, dev build
pnpm perf:message-lag -- --prod                # trustworthy numbers
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
for anything you intend to quote.

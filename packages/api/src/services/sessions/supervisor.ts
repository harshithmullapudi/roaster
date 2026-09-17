import {
  db,
  members,
  messages,
  projects,
  type SelectThread,
  threads,
} from "@roster/db";
import { bindingIsIdle, listAgentBindings,
  clearWorkspaceStatuses,
  createWorkspace,
  decryptApiKey,
  deleteWorkspace,
  eventsUrl,
  interruptAgent,
  isAgentLifecycle,
  mintJwt,
  readTranscript,
  routingKey,
  runAgent,
  sendToAgent,
} from "@roster/superset";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import {
  humanSessionError,
  readableError,
  sessionErrorDetail,
  workspaceAlreadyGone,
} from "../../utils/session-error";
import { sessionPrompt } from "../../utils/message-run";
import {
  type DelegationContext,
  rosterEnvelope,
} from "../../utils/roster-envelope";
import { agentReply, lastMeaningfulLine } from "../../utils/thread-progress";
import { textToTiptap } from "../../utils/tiptap";
import { allocateSeq, channelAgentIdentity } from "../channels";
import { channelName, publish } from "../centrifugo";

const POLL_INTERVAL_MS = 2000;
const WRITE_INTERVAL_MS = 1000;
const MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const SETTLE_DELAY_MS = 1500;
const STALENESS_TIMEOUT_MS = 60_000;

const TERMINAL_STATUSES = ["completed", "failed", "canceled"] as const;

export const THREAD_STATUSES = [
  "starting",
  "running",
  "waiting",
  "completed",
  "failed",
  "canceled",
] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];

function isTerminal(status: string): boolean {
  return status === "completed" || status === "failed" || status === "canceled";
}

/**
 * Parked mid-conversation: this thread asked another agent for something and
 * is holding its worktree until the answer arrives. Not terminal — it has an
 * outstanding delegation and will resume — but the watch loop stops, because
 * its agent's turn really has ended.
 */
function isParked(status: string): boolean {
  return status === "waiting";
}

/**
 * Park a thread on another agent's answer. Called before the child session
 * starts, so a child that answers instantly still finds a thread to wake.
 */
export async function markWaiting(args: {
  threadId: string;
  waitingOn: string;
}): Promise<void> {
  stopWatch(args.threadId);

  const row = await patch(args.threadId, {
    status: "waiting",
    lastProgress: `Waiting on @${args.waitingOn}…`,
    error: null,
  });
  if (row) await publishThread(row);
}

export function threadChannelName(threadId: string): string {
  return `thread:${threadId}`;
}

interface HostLink {
  socket: WebSocket | null;
  attempts: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  stopped: boolean;
}

interface Watch {
  threadId: string;
  hostKey: string;
  workspaceId: string;
  terminalId: string;
  pollTimer: ReturnType<typeof setInterval> | null;
  lastWriteAt: number;
  lastProgress: string | null;
  lastStartAt: number;
  lastStopAt: number;
  transcript: string | null;
  transcriptChangedAt: number;
  bindingEventAt: number | null;
  bindingChangedAt: number;
}

const hosts = new Map<string, HostLink>();
const watches = new Map<string, Watch>();
const byTerminal = new Map<string, string>();
const reaping = new Set<string>();
const finishing = new Set<string>();
const pendingSteers = new Map<string, string[]>();

let started = false;
let starting: Promise<void> | null = null;

async function threadById(threadId: string): Promise<SelectThread | null> {
  const row = await db.query.threads.findFirst({
    where: eq(threads.id, threadId),
  });
  return row ?? null;
}

async function patch(
  threadId: string,
  values: Partial<SelectThread>,
): Promise<SelectThread | null> {
  const [row] = await db
    .update(threads)
    .set(values)
    .where(eq(threads.id, threadId))
    .returning();
  return row ?? null;
}

async function publishThread(thread: SelectThread): Promise<void> {
  const payload = {
    type: "thread" as const,
    thread: {
      id: thread.id,
      projectId: thread.projectId,
      rootMessageId: thread.rootMessageId,
      status: thread.status,
      lastProgress: thread.lastProgress,
      error: readableError(thread.error),
      startedAt: thread.startedAt.toISOString(),
      endedAt: thread.endedAt ? thread.endedAt.toISOString() : null,
    },
  };
  await Promise.all([
    publish(threadChannelName(thread.id), payload),
    publish(channelName(thread.projectId), payload),
  ]);
}

async function connectionFor(thread: {
  organizationId: string;
  projectId: string;
}) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, thread.projectId),
  });
  if (!project) throw new Error("This channel is no longer linked to a project.");

  const member = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, thread.organizationId),
      eq(members.supersetOrgId, project.supersetOrgId),
    ),
  });
  if (!member?.supersetKeyEncrypted) {
    throw new Error("Nobody on this team has Superset connected.");
  }

  const { jwt } = await mintJwt(decryptApiKey(member.supersetKeyEncrypted));
  return {
    jwt,
    project,
    hostKey: routingKey(project.supersetOrgId, project.supersetHostId),
  };
}

async function jwtForHostKey(hostKey: string): Promise<string | null> {
  const supersetOrgId = hostKey.split(":")[0];
  if (!supersetOrgId) return null;
  const member = await db.query.members.findFirst({
    where: eq(members.supersetOrgId, supersetOrgId),
  });
  if (!member?.supersetKeyEncrypted) return null;
  const { jwt } = await mintJwt(decryptApiKey(member.supersetKeyEncrypted));
  return jwt;
}

/**
 * One socket per host, not per thread: `/events` is a host-wide bus, so every
 * thread on a machine is demultiplexed off the same connection by terminal id.
 */
function ensureHostLink(hostKey: string): void {
  const existing = hosts.get(hostKey);
  if (existing && (existing.socket || existing.retryTimer)) return;

  const link: HostLink = existing ?? {
    socket: null,
    attempts: 0,
    retryTimer: null,
    stopped: false,
  };
  link.stopped = false;
  hosts.set(hostKey, link);

  void (async () => {
    const jwt = await jwtForHostKey(hostKey);
    if (!jwt) {
      await failHostThreads(hostKey, "Nobody on this team has Superset connected.");
      return;
    }

    let socket: WebSocket;
    try {
      socket = new WebSocket(eventsUrl(hostKey), {
        headers: { Authorization: `Bearer ${jwt}` },
      } as unknown as string[]);
    } catch {
      scheduleHostRetry(hostKey);
      return;
    }

    link.socket = socket;

    socket.onopen = () => {
      const current = hosts.get(hostKey);
      if (current) current.attempts = 0;
    };

    socket.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (!isAgentLifecycle(parsed)) return;
      handleLifecycle(parsed.terminalId, parsed.eventType);
    };

    socket.onerror = () => {
      // `onclose` always follows and owns the retry decision.
    };

    socket.onclose = () => {
      const current = hosts.get(hostKey);
      if (!current || current.stopped) return;
      current.socket = null;
      if (hasWatchesOn(hostKey)) scheduleHostRetry(hostKey);
      else hosts.delete(hostKey);
    };
  })();
}

function hasWatchesOn(hostKey: string): boolean {
  for (const watch of watches.values()) {
    if (watch.hostKey === hostKey) return true;
  }
  return false;
}

function scheduleHostRetry(hostKey: string): void {
  const link = hosts.get(hostKey);
  if (!link || link.stopped) return;

  if (link.attempts >= MAX_ATTEMPTS) {
    void failHostThreads(
      hostKey,
      "That machine is offline — Roster stopped waiting for it.",
    );
    hosts.delete(hostKey);
    return;
  }

  const delay = Math.min(BASE_BACKOFF_MS * 2 ** link.attempts, MAX_BACKOFF_MS);
  link.attempts += 1;
  link.retryTimer = setTimeout(() => {
    const current = hosts.get(hostKey);
    if (current) current.retryTimer = null;
    if (hasWatchesOn(hostKey)) ensureHostLink(hostKey);
  }, delay);
}

async function failHostThreads(hostKey: string, reason: string): Promise<void> {
  const affected = [...watches.values()].filter(
    (watch) => watch.hostKey === hostKey,
  );
  for (const watch of affected) {
    await finish({ threadId: watch.threadId, status: "failed", error: reason });
  }
}

function handleLifecycle(terminalId: string, eventType: string): void {
  const threadId = byTerminal.get(terminalId);
  if (!threadId) return;

  const watch = watches.get(threadId);
  if (!watch) return;

  if (eventType === "Failed") {
    void finish({
      threadId,
      status: "failed",
      error: "The agent stopped with an error.",
      capture: true,
    });
    return;
  }

  if (eventType === "Start") {
    watch.lastStartAt = Date.now();
    return;
  }

  if (eventType === "Stop" || eventType === "Detached") {
    watch.lastStopAt = Date.now();
    void settle(threadId);
  }
}

/**
 * `Stop` ends a turn, not the agent: the CLI stays resident waiting for input,
 * so the terminal keeps a live foreground process either way and cannot say
 * whether work is over. A later `Start` is what distinguishes a turn boundary
 * mid-run from the agent going quiet, so settle on the race between them.
 */
async function settle(threadId: string): Promise<void> {
  const watch = watches.get(threadId);
  if (!watch) return;
  const stoppedAt = watch.lastStopAt;

  await new Promise((resolve) => setTimeout(resolve, SETTLE_DELAY_MS));

  const current = watches.get(threadId);
  if (!current || current.lastStopAt !== stoppedAt) return;
  if (current.lastStartAt > stoppedAt) return;

  const thread = await threadById(threadId);
  if (!thread || isTerminal(thread.status)) return;

  await finish({ threadId, status: "completed", error: null, capture: true });
}

async function pollOnce(threadId: string): Promise<void> {
  const watch = watches.get(threadId);
  if (!watch) return;

  const thread = await threadById(threadId);
  if (!thread || isTerminal(thread.status)) {
    stopWatch(threadId);
    return;
  }

  let text: string;
  let jwt: string;
  try {
    const connection = await connectionFor(thread);
    jwt = connection.jwt;
    const transcript = await readTranscript({
      jwt: connection.jwt,
      routingKey: watch.hostKey,
      workspaceId: watch.workspaceId,
      terminalId: watch.terminalId,
    });
    text = transcript.text;
  } catch (cause) {
    const reason = humanSessionError(cause, {
      fallback: "Could not read the agent's output.",
      retrying: true,
    });
    console.warn(
      `[sessions] transcript poll failed for ${threadId}: ${sessionErrorDetail(cause)}`,
    );
    if (workspaceAlreadyGone(cause)) {
      await finish({ threadId, status: "failed", error: reason });
      return;
    }
    if (thread.error !== reason) {
      const row = await patch(threadId, { error: reason });
      if (row) await publishThread(row);
    }
    return;
  }

  const now = Date.now();
  if (text !== watch.transcript) {
    watch.transcript = text;
    watch.transcriptChangedAt = now;
  }

  if (text.trim().length > 0 && pendingSteers.has(threadId)) {
    await drainSteers(threadId);
    return;
  }

  try {
    const bindings = await listAgentBindings({
      jwt,
      routingKey: watch.hostKey,
      workspaceId: watch.workspaceId,
    });
    const binding = bindings.find((b) => b.terminalId === watch.terminalId);
    if (bindingIsIdle(binding, SETTLE_DELAY_MS)) {
      await finish({
        threadId,
        status: "completed",
        error: null,
        capture: true,
      });
      return;
    }
    const eventAt = binding?.lastEventAt ?? null;
    if (eventAt !== watch.bindingEventAt) {
      watch.bindingEventAt = eventAt;
      watch.bindingChangedAt = now;
    }
  } catch (cause) {
    console.warn(
      `[sessions] binding check failed for ${threadId}: ${sessionErrorDetail(cause)}`,
    );
  }

  if (
    now - watch.transcriptChangedAt >= STALENESS_TIMEOUT_MS &&
    now - watch.bindingChangedAt >= STALENESS_TIMEOUT_MS
  ) {
    console.warn(
      `[sessions] staleness timeout for ${threadId} after ${STALENESS_TIMEOUT_MS}ms of no output and no agent events`,
    );
    await finish({ threadId, status: "completed", error: null, capture: true });
    return;
  }

  const line = lastMeaningfulLine(text);
  const progressed =
    line !== null &&
    line !== watch.lastProgress &&
    now - watch.lastWriteAt >= WRITE_INTERVAL_MS;
  const recovered = thread.error !== null;

  if (!progressed && !recovered) return;

  const values: Partial<SelectThread> = {};
  if (recovered) values.error = null;
  if (progressed && line !== null) {
    watch.lastProgress = line;
    watch.lastWriteAt = now;
    values.lastProgress = line;
    values.transcriptOffset = text.length;
  }

  const row = await patch(threadId, values);
  if (row) await publishThread(row);
}

function startWatch(args: {
  threadId: string;
  hostKey: string;
  workspaceId: string;
  terminalId: string;
}): void {
  stopWatch(args.threadId);

  const watch: Watch = {
    threadId: args.threadId,
    hostKey: args.hostKey,
    workspaceId: args.workspaceId,
    terminalId: args.terminalId,
    pollTimer: null,
    lastWriteAt: 0,
    lastProgress: null,
    lastStartAt: 0,
    lastStopAt: 0,
    transcript: null,
    transcriptChangedAt: Date.now(),
    bindingEventAt: null,
    bindingChangedAt: Date.now(),
  };
  watches.set(args.threadId, watch);
  byTerminal.set(args.terminalId, args.threadId);

  watch.pollTimer = setInterval(() => {
    void pollOnce(args.threadId);
  }, POLL_INTERVAL_MS);

  ensureHostLink(args.hostKey);
  void pollOnce(args.threadId);
}

function stopWatch(threadId: string): void {
  const watch = watches.get(threadId);
  if (!watch) return;
  if (watch.pollTimer) clearInterval(watch.pollTimer);
  byTerminal.delete(watch.terminalId);
  watches.delete(threadId);

  if (!hasWatchesOn(watch.hostKey)) {
    const link = hosts.get(watch.hostKey);
    if (link) {
      link.stopped = true;
      if (link.retryTimer) clearTimeout(link.retryTimer);
      try {
        link.socket?.close();
      } catch {
        // Already gone.
      }
      hosts.delete(watch.hostKey);
    }
  }
}

async function finish(args: {
  threadId: string;
  status: ThreadStatus;
  error?: string | null;
  capture?: boolean;
}): Promise<void> {
  if (finishing.has(args.threadId)) return;
  finishing.add(args.threadId);
  try {
    await finishOnce(args);
  } finally {
    finishing.delete(args.threadId);
  }
}

async function finishOnce(args: {
  threadId: string;
  status: ThreadStatus;
  error?: string | null;
  capture?: boolean;
}): Promise<void> {
  const watch = watches.get(args.threadId);
  const thread = await threadById(args.threadId);
  if (!thread || isTerminal(thread.status)) {
    stopWatch(args.threadId);
    return;
  }

  let finalText: string | null = null;
  if (args.capture && watch) {
    try {
      const connection = await connectionFor(thread);
      const transcript = await readTranscript({
        jwt: connection.jwt,
        routingKey: watch.hostKey,
        workspaceId: watch.workspaceId,
        terminalId: watch.terminalId,
      });
      finalText = agentReply(transcript.text);
    } catch {
      finalText = null;
    }
  }

  stopWatch(args.threadId);
  pendingSteers.delete(args.threadId);

  /**
   * A parked thread's agent has stopped talking, which is exactly what we told
   * it to do after handing work off — so keep what it said, but leave it
   * `waiting` rather than calling it finished. It resumes when the answer
   * lands, not when its turn ends.
   */
  if (isParked(thread.status)) {
    if (finalText && finalText.trim().length > 0) {
      await persistAgentMessage({ thread, text: finalText });
    }
    return;
  }

  const values: Partial<SelectThread> = {
    status: args.status,
    endedAt: new Date(),
  };
  if (args.error !== undefined) values.error = args.error;

  const row = await patch(args.threadId, values);
  if (!row) return;

  if (finalText && finalText.trim().length > 0) {
    await persistAgentMessage({ thread: row, text: finalText });
  }

  await publishThread(row);

  await settleIfDelegated({
    childThreadId: row.id,
    reply: finalText ?? "",
    failed: args.status !== "completed",
  });
}

/**
 * Imported lazily: `delegations` reaches back into this module for
 * `startSession` and `steer`, and a static import here would close that loop
 * at module-load time.
 */
async function settleIfDelegated(args: {
  childThreadId: string;
  reply: string;
  failed: boolean;
}): Promise<void> {
  try {
    const { settleDelegationFor } = await import("../delegations");
    await settleDelegationFor(args);
  } catch (cause) {
    console.warn(
      `[sessions] delegation settle failed for ${args.childThreadId}: ${sessionErrorDetail(cause)}`,
    );
  }
}

/**
 * `agentChannelId` names the speaker. It is usually the thread's own channel,
 * but a delegated answer is written into the asking channel's thread while
 * still being spoken by the channel that did the work — so it is a parameter,
 * not `thread.projectId`.
 */
export async function persistAgentMessage(args: {
  thread: SelectThread;
  text: string;
  agentChannelId?: string;
  dedupe?: boolean;
}): Promise<void> {
  const { thread, text } = args;
  const agentChannelId = args.agentChannelId ?? thread.projectId;

  if (args.dedupe !== false) {
    const existing = await db.query.messages.findFirst({
      where: and(eq(messages.threadId, thread.id), eq(messages.kind, "agent")),
      orderBy: desc(messages.seq),
    });
    if (existing?.text === text) return;
  }

  const seq = await allocateSeq(thread.projectId);
  const [row] = await db
    .insert(messages)
    .values({
      organizationId: thread.organizationId,
      projectId: thread.projectId,
      seq,
      authorMemberId: null,
      kind: "agent",
      agentChannelId,
      body: textToTiptap(text),
      text,
      threadId: thread.id,
      parentMessageId: thread.rootMessageId,
    })
    .returning();

  if (!row) return;

  const identity = await channelAgentIdentity(agentChannelId);

  const payload = {
    type: "message" as const,
    message: {
      id: row.id,
      projectId: row.projectId,
      seq: Number(row.seq),
      kind: row.kind,
      body: row.body,
      text: row.text,
      clientId: null,
      parentMessageId: row.parentMessageId,
      threadId: row.threadId,
      createdAt: row.createdAt.toISOString(),
      editedAt: null,
      authorMemberId: null,
      authorName: null,
      authorEmail: null,
      agentChannelId: row.agentChannelId,
      agentDisplay: identity?.agentDisplay ?? null,
      agentHandle: identity?.agentHandle ?? null,
    },
  };

  await Promise.all([
    publish(channelName(thread.projectId), payload),
    publish(threadChannelName(thread.id), payload),
  ]);
}

/**
 * The briefing that makes a terminal a Roster session: who it is and, above
 * all, its thread id — `roster ask --thread` needs it, and the prompt is the
 * only channel we have, since `runAgent` takes nothing else.
 *
 * Every path that opens a *fresh* terminal must call this. A resumed session
 * that lost its terminal gets a new one with no memory of the first briefing,
 * so re-sending it is what keeps a revived agent able to delegate.
 */
async function briefedPrompt(args: {
  thread: SelectThread;
  request: string;
  context?: string[];
  delegation?: DelegationContext;
}): Promise<string> {
  const identity = await channelAgentIdentity(args.thread.projectId);
  const envelope = rosterEnvelope({
    threadId: args.thread.id,
    channelId: args.thread.projectId,
    handle: identity?.agentHandle ?? "agent",
    delegation: args.delegation,
  });

  return `${envelope}\n\n${sessionPrompt({
    context: args.context ?? [],
    request: args.request,
  })}`;
}

export async function startSession(args: {
  threadId: string;
  text: string;
  context?: string[];
  delegation?: DelegationContext;
}): Promise<void> {
  const thread = await threadById(args.threadId);
  if (!thread) return;

  try {
    const connection = await connectionFor(thread);

    const workspace = await createWorkspace({
      jwt: connection.jwt,
      routingKey: connection.hostKey,
      projectId: connection.project.supersetProjectId,
      namingPrompt: args.text,
    });
    await patch(thread.id, {
      supersetWorkspaceId: workspace.id,
      supersetHostKey: connection.hostKey,
    });

    const prompt = await briefedPrompt({
      thread,
      request: args.text,
      context: args.context,
      delegation: args.delegation,
    });

    const run = await runAgent({
      jwt: connection.jwt,
      routingKey: connection.hostKey,
      workspaceId: workspace.id,
      prompt,
    });

    const running = await patch(thread.id, {
      supersetTerminalId: run.sessionId,
      status: "running",
      error: null,
    });
    if (running) await publishThread(running);

    startWatch({
      threadId: thread.id,
      hostKey: connection.hostKey,
      workspaceId: workspace.id,
      terminalId: run.sessionId,
    });
  } catch (cause) {
    console.warn(
      `[sessions] start failed for ${thread.id}: ${sessionErrorDetail(cause)}`,
    );
    pendingSteers.delete(thread.id);
    await finish({
      threadId: thread.id,
      status: "failed",
      error: humanSessionError(cause, {
        fallback: "Could not start a session on that machine.",
      }),
    });
  }
}

function queueSteer(threadId: string, text: string): void {
  const queue = pendingSteers.get(threadId) ?? [];
  queue.push(text);
  pendingSteers.set(threadId, queue);
  console.warn(`[sessions] queued steer for ${threadId} (${queue.length})`);
}

async function drainSteers(threadId: string): Promise<void> {
  const queue = pendingSteers.get(threadId);
  pendingSteers.delete(threadId);
  if (!queue) return;
  console.warn(`[sessions] draining ${queue.length} steer(s) for ${threadId}`);

  for (const text of queue) {
    await interrupt({ threadId, text });
  }
}

async function interrupt(args: {
  threadId: string;
  text: string;
}): Promise<void> {
  const thread = await threadById(args.threadId);
  if (!thread) return;
  if (!thread.supersetTerminalId || !thread.supersetWorkspaceId) {
    queueSteer(args.threadId, args.text);
    return;
  }

  try {
    const connection = await connectionFor(thread);
    await sendToAgent({
      jwt: connection.jwt,
      routingKey: connection.hostKey,
      workspaceId: thread.supersetWorkspaceId,
      terminalId: thread.supersetTerminalId,
      text: args.text,
    });

    const watch = watches.get(args.threadId);
    if (watch) watch.lastStartAt = Date.now();

    const row = await patch(args.threadId, { status: "running", error: null });
    if (row) await publishThread(row);

    if (!watches.has(args.threadId)) {
      startWatch({
        threadId: args.threadId,
        hostKey: connection.hostKey,
        workspaceId: thread.supersetWorkspaceId,
        terminalId: thread.supersetTerminalId,
      });
    }
  } catch (cause) {
    console.warn(
      `[sessions] steer failed for ${args.threadId}: ${sessionErrorDetail(cause)}`,
    );
    const row = await patch(args.threadId, {
      error: humanSessionError(cause, {
        fallback: "Could not reach the running session.",
      }),
    });
    if (row) await publishThread(row);
  }
}

async function resume(args: { threadId: string; text: string }): Promise<void> {
  const thread = await threadById(args.threadId);
  if (!thread?.supersetWorkspaceId || thread.workspaceReapedAt) {
    await recordThreadError(
      args.threadId,
      "That session has no worktree left to reply into.",
    );
    return;
  }

  const revived = await patch(args.threadId, {
    status: "running",
    endedAt: null,
    error: null,
  });
  if (revived) await publishThread(revived);

  try {
    const connection = await connectionFor(thread);
    let terminalId = thread.supersetTerminalId;

    if (terminalId) {
      try {
        await sendToAgent({
          jwt: connection.jwt,
          routingKey: connection.hostKey,
          workspaceId: thread.supersetWorkspaceId,
          terminalId,
          text: args.text,
        });
      } catch {
        terminalId = null;
      }
    }

    if (!terminalId) {
      const run = await runAgent({
        jwt: connection.jwt,
        routingKey: connection.hostKey,
        workspaceId: thread.supersetWorkspaceId,
        // A new terminal has no memory of the first briefing — re-send it.
        prompt: await briefedPrompt({ thread, request: args.text }),
      });
      terminalId = run.sessionId;
      await patch(args.threadId, { supersetTerminalId: terminalId });
    }

    startWatch({
      threadId: args.threadId,
      hostKey: connection.hostKey,
      workspaceId: thread.supersetWorkspaceId,
      terminalId,
    });

    const watch = watches.get(args.threadId);
    if (watch) watch.lastStartAt = Date.now();
  } catch (cause) {
    console.warn(
      `[sessions] resume failed for ${args.threadId}: ${sessionErrorDetail(cause)}`,
    );
    await finish({
      threadId: args.threadId,
      status: "failed",
      error: humanSessionError(cause, {
        fallback: "Could not reach that machine to continue the session.",
      }),
    });
  }
}

async function recordThreadError(
  threadId: string,
  reason: string,
): Promise<void> {
  const row = await patch(threadId, { error: reason });
  if (row) await publishThread(row);
}

export async function steer(args: {
  threadId: string;
  text: string;
}): Promise<void> {
  await ensureStarted();

  const thread = await threadById(args.threadId);
  if (!thread) return;

  /**
   * A parked thread's CLI has gone quiet and its watch is stopped, so it needs
   * the same re-entry a finished thread does — its worktree is still there.
   */
  if (isTerminal(thread.status) || isParked(thread.status)) {
    await resume(args);
    return;
  }

  await interrupt(args);
}

async function retryPrompt(thread: SelectThread): Promise<string> {
  const latest = await db.query.messages.findFirst({
    where: and(eq(messages.threadId, thread.id), eq(messages.kind, "user")),
    orderBy: desc(messages.seq),
  });
  const text = latest?.text?.trim();
  if (text && text.length > 0) return text;

  const root = await db.query.messages.findFirst({
    where: eq(messages.id, thread.rootMessageId),
  });
  const rootText = root?.text?.trim();
  return rootText && rootText.length > 0 ? rootText : "Continue.";
}

async function reattach(thread: SelectThread): Promise<void> {
  const workspaceId = thread.supersetWorkspaceId;
  if (!workspaceId) return;

  try {
    const connection = await connectionFor(thread);
    let terminalId = thread.supersetTerminalId;

    if (terminalId) {
      try {
        await readTranscript({
          jwt: connection.jwt,
          routingKey: connection.hostKey,
          workspaceId,
          terminalId,
        });
      } catch {
        terminalId = null;
      }
    }

    if (!terminalId) {
      const run = await runAgent({
        jwt: connection.jwt,
        routingKey: connection.hostKey,
        workspaceId,
        // Also a fresh terminal — it needs the briefing as much as the first.
        prompt: await briefedPrompt({
          thread,
          request: await retryPrompt(thread),
        }),
      });
      terminalId = run.sessionId;
      await patch(thread.id, { supersetTerminalId: terminalId });
    }

    startWatch({
      threadId: thread.id,
      hostKey: connection.hostKey,
      workspaceId,
      terminalId,
    });

    const watch = watches.get(thread.id);
    if (watch) watch.lastStartAt = Date.now();
  } catch (cause) {
    console.warn(
      `[sessions] retry failed for ${thread.id}: ${sessionErrorDetail(cause)}`,
    );
    await finish({
      threadId: thread.id,
      status: "failed",
      error: humanSessionError(cause, {
        fallback: "Could not reach that machine to retry the session.",
      }),
    });
  }
}

export async function cancelThread(args: {
  threadId: string;
}): Promise<boolean> {
  await ensureStarted();

  const thread = await threadById(args.threadId);
  if (!thread) return false;
  if (isTerminal(thread.status)) return false;

  if (thread.supersetWorkspaceId && thread.supersetTerminalId) {
    try {
      const connection = await connectionFor(thread);
      await interruptAgent({
        jwt: connection.jwt,
        routingKey: thread.supersetHostKey ?? connection.hostKey,
        workspaceId: thread.supersetWorkspaceId,
        terminalId: thread.supersetTerminalId,
      });
      await clearWorkspaceStatuses({
        jwt: connection.jwt,
        routingKey: thread.supersetHostKey ?? connection.hostKey,
        workspaceId: thread.supersetWorkspaceId,
        terminalId: thread.supersetTerminalId,
      });
    } catch (cause) {
      console.warn(
        `[sessions] cancel on host failed for ${args.threadId}: ${sessionErrorDetail(cause)}`,
      );
    }
  }

  await finish({ threadId: args.threadId, status: "canceled", error: null });

  return true;
}

export async function retryThread(args: {
  threadId: string;
}): Promise<boolean> {
  await ensureStarted();

  const thread = await threadById(args.threadId);
  if (!thread) return false;
  if (!thread.supersetWorkspaceId || thread.workspaceReapedAt) {
    await recordThreadError(
      args.threadId,
      "That session has no worktree left to retry.",
    );
    return false;
  }

  stopWatch(args.threadId);

  const revived = await patch(args.threadId, {
    status: "running",
    endedAt: null,
    error: null,
  });
  if (revived) await publishThread(revived);

  void reattach(revived ?? thread).catch(() => {});

  return true;
}

/**
 * Idempotent. Resumes every thread the database still calls live — all of
 * them, concurrently, since a channel can run many at once — and reaps the
 * worktrees a terminal thread still holds so a crash mid-teardown self-heals.
 */
export function ensureStarted(): Promise<void> {
  if (started) return Promise.resolve();
  if (starting) return starting;

  starting = (async () => {
    const rows = await db.query.threads.findMany({
      where: inArray(threads.status, ["starting", "running"]),
    });
    started = true;
    for (const row of rows) {
      if (row.supersetTerminalId && row.supersetWorkspaceId && row.supersetHostKey) {
        startWatch({
          threadId: row.id,
          hostKey: row.supersetHostKey,
          workspaceId: row.supersetWorkspaceId,
          terminalId: row.supersetTerminalId,
        });
      }
    }
  })().catch(() => {
    started = true;
  });

  return starting;
}

export async function createThread(args: {
  organizationId: string;
  projectId: string;
  rootMessageId: string;
}): Promise<SelectThread | null> {
  const [row] = await db
    .insert(threads)
    .values({
      organizationId: args.organizationId,
      projectId: args.projectId,
      rootMessageId: args.rootMessageId,
      status: "starting",
    })
    .onConflictDoNothing({ target: threads.rootMessageId })
    .returning();

  if (row) {
    await db
      .update(messages)
      .set({ threadId: row.id })
      .where(and(eq(messages.id, args.rootMessageId), isNull(messages.threadId)));
    await publishThread(row);
  }

  return row ?? null;
}

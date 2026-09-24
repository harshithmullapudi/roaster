import { db, members, messages, taskRuns, tasks } from "@roster/db";
import { and, asc, desc, eq, isNotNull, lte } from "drizzle-orm";

import { nextOccurrence, parseRecurrence } from "../lib/recurrence";
import { textToTiptap } from "../utils/tiptap";

import { allocateSeq, requireOrgProject, type ChannelScope } from "./channels";
import { emitMessageById } from "./message-events";
import { ensureStarted } from "./sessions";
import { postTask } from "./task-assignment";
import { findById, type Task } from "./tasks";

export const RUN_OUTCOMES = [
  "fired",
  "skipped_late",
  "skipped_no_access",
  "failed",
] as const;

export type RunOutcome = (typeof RUN_OUTCOMES)[number];

export const LATE_GRACE_MS = 15 * 60 * 1000;

const SWEEP_BATCH = 200;
const CATCHUP_LIMIT = 500;

export interface TaskRun {
  id: string;
  slotAt: Date;
  outcome: RunOutcome;
  detail: string | null;
  createdAt: Date;
}

export function firstOccurrence(args: {
  rrule: string;
  timezone: string;
  from?: Date;
}): Date | null {
  parseRecurrence(args.rrule);

  const from = args.from ?? new Date();

  return nextOccurrence({
    rule: args.rrule,
    timezone: args.timezone,
    after: from,
    anchor: from,
  });
}

export async function setRecurrence(args: {
  taskId: string;
  rrule: string | null;
  timezone?: string;
}): Promise<Task | null> {
  const timezone = args.timezone ?? "UTC";

  const nextRunAt = args.rrule
    ? firstOccurrence({ rrule: args.rrule, timezone })
    : null;

  await db
    .update(tasks)
    .set({
      rrule: args.rrule,
      timezone,
      nextRunAt,
      recurrenceDisabledReason: null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, args.taskId));

  return findById(args.taskId);
}

export async function listRuns(
  args: ChannelScope & { taskId: string; limit?: number },
): Promise<TaskRun[]> {
  const rows = await db
    .select({
      id: taskRuns.id,
      slotAt: taskRuns.slotAt,
      outcome: taskRuns.outcome,
      detail: taskRuns.detail,
      createdAt: taskRuns.createdAt,
    })
    .from(taskRuns)
    .where(eq(taskRuns.taskId, args.taskId))
    .orderBy(desc(taskRuns.createdAt))
    .limit(Math.min(args.limit ?? 10, 50));

  return rows.map((row) => ({ ...row, outcome: row.outcome as RunOutcome }));
}

export interface SweepSummary {
  considered: number;
  fired: number;
  skipped: number;
}

export async function sweepTasks(now = new Date()): Promise<SweepSummary> {
  const due = await db
    .select()
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.rrule),
        isNotNull(tasks.nextRunAt),
        lte(tasks.nextRunAt, now),
      ),
    )
    .orderBy(asc(tasks.nextRunAt))
    .limit(SWEEP_BATCH);

  const summary: SweepSummary = { considered: due.length, fired: 0, skipped: 0 };

  for (const row of due) {
    try {
      const result = await advance(row, now);
      summary.fired += result.fired;
      summary.skipped += result.skipped;
    } catch (cause) {
      console.warn(
        `[recurrence] task ${row.id} failed to advance: ${(cause as Error).message}`,
      );
    }
  }

  return summary;
}

type TaskRow = typeof tasks.$inferSelect;

async function advance(
  row: TaskRow,
  now: Date,
): Promise<{ fired: number; skipped: number }> {
  let slot = row.nextRunAt;
  let fired = 0;
  let skipped = 0;
  let steps = 0;

  while (slot && slot.getTime() <= now.getTime() && steps++ < CATCHUP_LIMIT) {
    const late = now.getTime() - slot.getTime() > LATE_GRACE_MS;

    if (late) {
      if (await claimSlot(row.id, slot, "skipped_late")) skipped += 1;
    } else if (fired === 0) {
      const outcome = await fireSlot(row, slot);
      if (outcome === "stopped") return { fired, skipped };
      if (outcome === "fired") fired += 1;
    } else {
      break;
    }

    slot = nextOccurrence({
      rule: row.rrule!,
      timezone: row.timezone,
      after: slot,
      anchor: row.createdAt,
    });
  }

  await db
    .update(tasks)
    .set({ nextRunAt: slot, updatedAt: new Date() })
    .where(eq(tasks.id, row.id));

  return { fired, skipped };
}

async function claimSlot(
  taskId: string,
  slotAt: Date,
  outcome: RunOutcome,
  detail?: string,
): Promise<string | null> {
  const [claimed] = await db
    .insert(taskRuns)
    .values({ taskId, slotAt, outcome, detail })
    .onConflictDoNothing({ target: [taskRuns.taskId, taskRuns.slotAt] })
    .returning({ id: taskRuns.id });

  return claimed?.id ?? null;
}

type FireOutcome = "fired" | "taken" | "stopped" | "failed";

async function fireSlot(row: TaskRow, slotAt: Date): Promise<FireOutcome> {
  const runId = await claimSlot(row.id, slotAt, "fired");
  if (!runId) return "taken";

  const actor = row.createdByMemberId
    ? await memberFor(row.createdByMemberId, row.organizationId)
    : null;

  const project =
    actor && row.projectId
      ? await requireOrgProject({
          organizationId: row.organizationId,
          memberId: actor.id,
          role: actor.role,
          projectId: row.projectId,
        })
      : null;

  if (!project) {
    await denied(row, runId);
    return "stopped";
  }

  try {
    await ensureStarted();

    await db
      .update(tasks)
      .set({
        status: "todo",
        completedAt: null,
        threadId: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, row.id));

    await postTask({
      organizationId: row.organizationId,
      projectId: project.id,
      authorMemberId: actor!.id,
      role: actor!.role,
      taskId: row.id,
      title: row.title,
      slotAt,
    });

    return "fired";
  } catch (cause) {
    await db
      .update(taskRuns)
      .set({ outcome: "failed", detail: (cause as Error).message })
      .where(eq(taskRuns.id, runId));

    return "failed";
  }
}

async function memberFor(
  memberId: string,
  organizationId: string,
): Promise<{ id: string; role: string } | null> {
  const [row] = await db
    .select({ id: members.id, role: members.role })
    .from(members)
    .where(
      and(eq(members.id, memberId), eq(members.organizationId, organizationId)),
    )
    .limit(1);

  return row ?? null;
}

const NO_ACCESS =
  "stopped repeating: whoever created it can no longer reach this channel. " +
  "Set the schedule again from an account that can.";

async function denied(row: TaskRow, runId: string): Promise<void> {
  const reason = row.projectId
    ? "Whoever created this task has lost access to its channel."
    : "This repeating task has no channel to post into.";

  await db
    .update(taskRuns)
    .set({ outcome: "skipped_no_access", detail: reason })
    .where(eq(taskRuns.id, runId));

  await db
    .update(tasks)
    .set({
      rrule: null,
      nextRunAt: null,
      recurrenceDisabledReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, row.id));

  if (row.projectId) await postNotice(row, `"${row.title}" ${NO_ACCESS}`);
}

async function postNotice(row: TaskRow, text: string): Promise<void> {
  const projectId = row.projectId!;
  const seq = await allocateSeq(projectId);

  const [inserted] = await db
    .insert(messages)
    .values({
      organizationId: row.organizationId,
      projectId,
      seq,
      authorMemberId: row.createdByMemberId,
      kind: "user",
      body: textToTiptap(text),
      text,
      clientId: `recurrence-stopped:${row.id}`,
    })
    .onConflictDoNothing({ target: [messages.projectId, messages.clientId] })
    .returning({ id: messages.id });

  if (inserted) await emitMessageById(inserted.id);
}

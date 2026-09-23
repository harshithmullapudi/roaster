import {
  db,
  members,
  messages,
  projects,
  scheduledTaskRuns,
  scheduledTasks,
  users,
} from "@roster/db";
import { and, asc, desc, eq, isNotNull, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { nextOccurrence, parseRecurrence } from "../lib/recurrence";
import { textToTiptap } from "../utils/tiptap";

import { allocateSeq, requireOrgProject, type ChannelScope } from "./channels";
import { emitMessageById } from "./message-events";
import { ensureStarted } from "./sessions";
import { postTask } from "./task-assignment";
import { createTask, setTaskProject } from "./tasks";

export const SCHEDULE_OUTCOMES = [
  "fired",
  "skipped_late",
  "skipped_no_access",
  "failed",
] as const;

export type ScheduleOutcome = (typeof SCHEDULE_OUTCOMES)[number];

export const LATE_GRACE_MS = 15 * 60 * 1000;

const SWEEP_BATCH = 200;
const CATCHUP_LIMIT = 500;

export interface ScheduleMember {
  memberId: string;
  name: string;
}

export interface Schedule {
  id: string;
  projectId: string;
  channelSlug: string | null;
  title: string;
  rrule: string;
  timezone: string;
  nextRunAt: Date | null;
  enabled: boolean;
  disabledReason: string | null;
  lastRunAt: Date | null;
  runAs: ScheduleMember | null;
  createdBy: ScheduleMember | null;
  createdAt: Date;
}

export interface ScheduleRun {
  id: string;
  slotAt: Date;
  taskId: string | null;
  outcome: ScheduleOutcome;
  detail: string | null;
  createdAt: Date;
}

const runAsMember = alias(members, "schedule_run_as_member");
const runAsUser = alias(users, "schedule_run_as_user");
const creatorMember = alias(members, "schedule_creator_member");
const creatorUser = alias(users, "schedule_creator_user");

function scheduleFrom(row: {
  id: string;
  projectId: string;
  channelSlug: string | null;
  title: string;
  rrule: string;
  timezone: string;
  nextRunAt: Date | null;
  enabled: boolean;
  disabledReason: string | null;
  lastRunAt: Date | null;
  runAsMemberId: string | null;
  runAsName: string | null;
  runAsEmail: string | null;
  createdByMemberId: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: Date;
}): Schedule {
  const {
    runAsMemberId,
    runAsName,
    runAsEmail,
    createdByMemberId,
    createdByName,
    createdByEmail,
    ...rest
  } = row;

  return {
    ...rest,
    runAs: person(runAsMemberId, runAsName, runAsEmail),
    createdBy: person(createdByMemberId, createdByName, createdByEmail),
  };
}

function person(
  memberId: string | null,
  name: string | null,
  email: string | null,
): ScheduleMember | null {
  const label = name || email;
  return memberId && label ? { memberId, name: label } : null;
}

const scheduleColumns = {
  id: scheduledTasks.id,
  projectId: scheduledTasks.projectId,
  channelSlug: projects.slug,
  title: scheduledTasks.title,
  rrule: scheduledTasks.rrule,
  timezone: scheduledTasks.timezone,
  nextRunAt: scheduledTasks.nextRunAt,
  enabled: scheduledTasks.enabled,
  disabledReason: scheduledTasks.disabledReason,
  lastRunAt: scheduledTasks.lastRunAt,
  runAsMemberId: scheduledTasks.runAsMemberId,
  runAsName: runAsUser.name,
  runAsEmail: runAsUser.email,
  createdByMemberId: scheduledTasks.createdByMemberId,
  createdByName: creatorUser.name,
  createdByEmail: creatorUser.email,
  createdAt: scheduledTasks.createdAt,
};

function selectSchedules() {
  return db
    .select(scheduleColumns)
    .from(scheduledTasks)
    .leftJoin(projects, eq(scheduledTasks.projectId, projects.id))
    .leftJoin(runAsMember, eq(scheduledTasks.runAsMemberId, runAsMember.id))
    .leftJoin(runAsUser, eq(runAsMember.userId, runAsUser.id))
    .leftJoin(creatorMember, eq(scheduledTasks.createdByMemberId, creatorMember.id))
    .leftJoin(creatorUser, eq(creatorMember.userId, creatorUser.id));
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

export async function listSchedules(
  scope: ChannelScope & { projectId: string },
): Promise<Schedule[]> {
  const project = await requireOrgProject(scope);
  if (!project) return [];

  const rows = await selectSchedules()
    .where(eq(scheduledTasks.projectId, project.id))
    .orderBy(asc(scheduledTasks.createdAt));

  return rows.map(scheduleFrom);
}

export async function scheduleById(
  scope: ChannelScope & { scheduleId: string },
): Promise<Schedule | null> {
  const [row] = await selectSchedules()
    .where(
      and(
        eq(scheduledTasks.id, scope.scheduleId),
        eq(scheduledTasks.organizationId, scope.organizationId),
      ),
    )
    .limit(1);

  if (!row) return null;

  const project = await requireOrgProject({
    organizationId: scope.organizationId,
    memberId: scope.memberId,
    role: scope.role,
    projectId: row.projectId,
  });
  if (!project) return null;

  return scheduleFrom(row);
}

export async function createSchedule(
  args: ChannelScope & {
    projectId: string;
    title: string;
    rrule: string;
    timezone: string;
  },
): Promise<Schedule | null> {
  const project = await requireOrgProject(args);
  if (!project) return null;

  const nextRunAt = firstOccurrence({
    rrule: args.rrule,
    timezone: args.timezone,
  });

  const [inserted] = await db
    .insert(scheduledTasks)
    .values({
      organizationId: args.organizationId,
      projectId: project.id,
      title: args.title,
      rrule: args.rrule,
      timezone: args.timezone,
      nextRunAt,
      runAsMemberId: args.memberId,
      createdByMemberId: args.memberId,
    })
    .returning({ id: scheduledTasks.id });

  if (!inserted) return null;

  return scheduleById({ ...args, scheduleId: inserted.id });
}

export async function updateSchedule(
  args: ChannelScope & {
    scheduleId: string;
    title?: string;
    rrule?: string;
    timezone?: string;
    enabled?: boolean;
  },
): Promise<Schedule | null> {
  const existing = await scheduleById(args);
  if (!existing) return null;

  const rrule = args.rrule ?? existing.rrule;
  const timezone = args.timezone ?? existing.timezone;
  const ruleChanged = rrule !== existing.rrule || timezone !== existing.timezone;
  const reviving = args.enabled === true && !existing.enabled;

  const nextRunAt =
    ruleChanged || reviving
      ? firstOccurrence({ rrule, timezone })
      : existing.nextRunAt;

  await db
    .update(scheduledTasks)
    .set({
      title: args.title ?? existing.title,
      rrule,
      timezone,
      enabled: args.enabled ?? existing.enabled,
      disabledReason: reviving ? null : undefined,
      nextRunAt,
      updatedAt: new Date(),
    })
    .where(eq(scheduledTasks.id, existing.id));

  return scheduleById(args);
}

export async function deleteSchedule(
  args: ChannelScope & { scheduleId: string },
): Promise<boolean> {
  const existing = await scheduleById(args);
  if (!existing) return false;

  await db.delete(scheduledTasks).where(eq(scheduledTasks.id, existing.id));
  return true;
}

export async function listRuns(
  args: ChannelScope & { scheduleId: string; limit?: number },
): Promise<ScheduleRun[]> {
  const existing = await scheduleById(args);
  if (!existing) return [];

  const rows = await db
    .select({
      id: scheduledTaskRuns.id,
      slotAt: scheduledTaskRuns.slotAt,
      taskId: scheduledTaskRuns.taskId,
      outcome: scheduledTaskRuns.outcome,
      detail: scheduledTaskRuns.detail,
      createdAt: scheduledTaskRuns.createdAt,
    })
    .from(scheduledTaskRuns)
    .where(eq(scheduledTaskRuns.scheduledTaskId, existing.id))
    .orderBy(desc(scheduledTaskRuns.createdAt))
    .limit(Math.min(args.limit ?? 10, 50));

  return rows.map((row) => ({
    ...row,
    outcome: row.outcome as ScheduleOutcome,
  }));
}

export interface SweepSummary {
  considered: number;
  fired: number;
  skipped: number;
}

export async function sweepSchedules(now = new Date()): Promise<SweepSummary> {
  const due = await db
    .select()
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.enabled, true),
        isNotNull(scheduledTasks.nextRunAt),
        lte(scheduledTasks.nextRunAt, now),
      ),
    )
    .orderBy(asc(scheduledTasks.nextRunAt))
    .limit(SWEEP_BATCH);

  const summary: SweepSummary = {
    considered: due.length,
    fired: 0,
    skipped: 0,
  };

  for (const row of due) {
    try {
      const result = await advance(row, now);
      summary.fired += result.fired;
      summary.skipped += result.skipped;
    } catch (cause) {
      console.warn(
        `[schedules] ${row.id} failed to advance: ${(cause as Error).message}`,
      );
    }
  }

  return summary;
}

type ScheduleRow = typeof scheduledTasks.$inferSelect;

async function advance(
  row: ScheduleRow,
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
      if (await fireSlot(row, slot)) fired += 1;
    } else {
      break;
    }

    slot = nextOccurrence({
      rule: row.rrule,
      timezone: row.timezone,
      after: slot,
      anchor: row.createdAt,
    });
  }

  await db
    .update(scheduledTasks)
    .set({
      nextRunAt: slot,
      lastRunAt: fired > 0 ? now : row.lastRunAt,
      updatedAt: new Date(),
    })
    .where(eq(scheduledTasks.id, row.id));

  return { fired, skipped };
}

async function claimSlot(
  scheduledTaskId: string,
  slotAt: Date,
  outcome: ScheduleOutcome,
  detail?: string,
): Promise<string | null> {
  const [claimed] = await db
    .insert(scheduledTaskRuns)
    .values({ scheduledTaskId, slotAt, outcome, detail })
    .onConflictDoNothing({
      target: [scheduledTaskRuns.scheduledTaskId, scheduledTaskRuns.slotAt],
    })
    .returning({ id: scheduledTaskRuns.id });

  return claimed?.id ?? null;
}

async function fireSlot(row: ScheduleRow, slotAt: Date): Promise<boolean> {
  const runId = await claimSlot(row.id, slotAt, "fired");
  if (!runId) return false;

  const actor = row.runAsMemberId
    ? await memberFor(row.runAsMemberId, row.organizationId)
    : null;

  const project = actor
    ? await requireOrgProject({
        organizationId: row.organizationId,
        memberId: actor.id,
        role: actor.role,
        projectId: row.projectId,
      })
    : null;

  if (!project) {
    await denied(row, runId);
    return false;
  }

  try {
    await ensureStarted();

    const task = await createTask({
      organizationId: row.organizationId,
      memberId: actor!.id,
      title: row.title,
      status: "todo",
    });
    if (!task) throw new Error("the task row could not be created");

    await setTaskProject({ taskId: task.id, projectId: project.id });

    await postTask({
      organizationId: row.organizationId,
      projectId: project.id,
      authorMemberId: actor!.id,
      role: actor!.role,
      taskId: task.id,
      title: row.title,
    });

    await db
      .update(scheduledTaskRuns)
      .set({ taskId: task.id })
      .where(eq(scheduledTaskRuns.id, runId));

    return true;
  } catch (cause) {
    await db
      .update(scheduledTaskRuns)
      .set({ outcome: "failed", detail: (cause as Error).message })
      .where(eq(scheduledTaskRuns.id, runId));

    return false;
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
      and(
        eq(members.id, memberId),
        eq(members.organizationId, organizationId),
      ),
    )
    .limit(1);

  return row ?? null;
}

const NO_ACCESS =
  "cannot reach this channel any more, so the schedule has been turned off. " +
  "Re-enable it in channel settings once whoever it runs as has access again.";

async function denied(row: ScheduleRow, runId: string): Promise<void> {
  const reason = row.runAsMemberId
    ? "The member this schedule runs as has lost access to the channel."
    : "This schedule has nobody to run as.";

  await db
    .update(scheduledTaskRuns)
    .set({ outcome: "skipped_no_access", detail: reason })
    .where(eq(scheduledTaskRuns.id, runId));

  await db
    .update(scheduledTasks)
    .set({ enabled: false, disabledReason: reason, updatedAt: new Date() })
    .where(eq(scheduledTasks.id, row.id));

  await postNotice(row, `"${row.title}" ${NO_ACCESS}`);
}

async function postNotice(row: ScheduleRow, text: string): Promise<void> {
  const seq = await allocateSeq(row.projectId);

  const [inserted] = await db
    .insert(messages)
    .values({
      organizationId: row.organizationId,
      projectId: row.projectId,
      seq,
      authorMemberId: row.createdByMemberId,
      kind: "user",
      body: textToTiptap(text),
      text,
      clientId: `schedule-disabled:${row.id}`,
    })
    .onConflictDoNothing({ target: [messages.projectId, messages.clientId] })
    .returning({ id: messages.id });

  if (inserted) await emitMessageById(inserted.id);
}

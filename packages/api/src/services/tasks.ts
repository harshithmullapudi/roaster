import { db, projects, tasks } from "@roster/db";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { normalizeTaskStatus, type TaskStatus } from "../lib/task-status";

import {
  listChannels,
  requireOrgProject,
  type ChannelScope,
} from "./channels";

/**
 * A task is a title and a status. Everything else on it is about *where* the
 * work went: a channel once someone decided whose it is, and the thread that
 * channel's agent is doing it in. Both are null while it sits in the backlog.
 */
export interface Task {
  id: string;
  projectId: string | null;
  threadId: string | null;
  title: string;
  status: TaskStatus;
  createdAt: Date;
  completedAt: Date | null;
  channelSlug: string | null;
  channelName: string | null;
}

const taskColumns = {
  id: tasks.id,
  projectId: tasks.projectId,
  threadId: tasks.threadId,
  title: tasks.title,
  status: tasks.status,
  createdAt: tasks.createdAt,
  completedAt: tasks.completedAt,
  channelSlug: projects.slug,
  channelName: projects.name,
};

function toTask(row: {
  id: string;
  projectId: string | null;
  threadId: string | null;
  title: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  channelSlug: string | null;
  channelName: string | null;
}): Task {
  return { ...row, status: normalizeTaskStatus(row.status) };
}

export async function listTasks(
  scope: ChannelScope & { projectId?: string },
): Promise<Task[]> {
  if (scope.projectId) {
    const project = await requireOrgProject({
      organizationId: scope.organizationId,
      memberId: scope.memberId,
      role: scope.role,
      projectId: scope.projectId,
    });
    if (!project) return [];

    const rows = await db
      .select(taskColumns)
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(tasks.projectId, project.id))
      .orderBy(desc(tasks.createdAt));

    return rows.map(toTask);
  }

  const groups = await listChannels(scope);
  const visibleIds = [
    ...groups.starred,
    ...groups.public,
    ...groups.private,
  ].map((channel) => channel.id);

  /**
   * Backlog tasks belong to nobody, so no channel can vouch for them — they
   * are visible to the whole team, which is the point of a backlog.
   */
  const reachable =
    visibleIds.length > 0
      ? or(isNull(tasks.projectId), inArray(tasks.projectId, visibleIds))
      : isNull(tasks.projectId);

  const rows = await db
    .select(taskColumns)
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.organizationId, scope.organizationId), reachable))
    .orderBy(desc(tasks.createdAt));

  return rows.map(toTask);
}

/**
 * File a task. It lands in the backlog: a channel is never set here, only by
 * `assignTask`, which sets it together with the thread doing the work — so a
 * task with a channel always has somewhere to point at.
 */
export async function createTask(args: {
  organizationId: string;
  memberId: string;
  title: string;
  status: TaskStatus;
}): Promise<Task | null> {
  const [inserted] = await db
    .insert(tasks)
    .values({
      organizationId: args.organizationId,
      title: args.title,
      status: args.status,
      createdByMemberId: args.memberId,
      completedAt: args.status === "done" ? new Date() : null,
    })
    .returning({ id: tasks.id });

  if (!inserted) return null;
  return findById(inserted.id);
}

export async function setTaskStatus(
  args: ChannelScope & { taskId: string; status: TaskStatus },
): Promise<Task | null> {
  const task = await reachableTask(args);
  if (!task) return null;

  await db
    .update(tasks)
    .set({
      status: args.status,
      updatedAt: new Date(),
      completedAt: args.status === "done" ? new Date() : null,
    })
    .where(eq(tasks.id, task.id));

  return findById(task.id);
}

/**
 * A task as the member asking for it may see it: it must be their team's, and
 * if it has a channel they must be able to open that channel. A backlog task
 * clears on team membership alone.
 */
export async function reachableTask(
  args: ChannelScope & { taskId: string },
): Promise<Task | null> {
  const [row] = await db
    .select(taskColumns)
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(tasks.id, args.taskId),
        eq(tasks.organizationId, args.organizationId),
      ),
    )
    .limit(1);

  if (!row) return null;
  const task = toTask(row);

  if (task.projectId) {
    const project = await requireOrgProject({
      organizationId: args.organizationId,
      memberId: args.memberId,
      role: args.role,
      projectId: task.projectId,
    });
    if (!project) return null;
  }

  return task;
}

/** Point a task at the channel and thread now carrying it. */
export async function linkTaskThread(args: {
  taskId: string;
  projectId: string;
  threadId: string;
}): Promise<Task | null> {
  await db
    .update(tasks)
    .set({
      projectId: args.projectId,
      threadId: args.threadId,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, args.taskId));

  return findById(args.taskId);
}

/**
 * The task a session is working on, if it was started by an assignment. Read
 * when briefing an agent, so the task travels with every prompt into that
 * thread — the first one and every resume after it.
 */
export async function taskForThread(threadId: string): Promise<Task | null> {
  const [row] = await db
    .select(taskColumns)
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.threadId, threadId))
    .limit(1);

  return row ? toTask(row) : null;
}

export async function findById(id: string): Promise<Task | null> {
  const [row] = await db
    .select(taskColumns)
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.id, id))
    .limit(1);

  return row ? toTask(row) : null;
}

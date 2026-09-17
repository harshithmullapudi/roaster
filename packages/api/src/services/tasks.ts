import { db, projects, tasks } from "@roster/db";
import { and, desc, eq, inArray } from "drizzle-orm";

import { normalizeTaskStatus, type TaskStatus } from "../lib/task-status";

import {
  listChannels,
  requireOrgProject,
  type ChannelScope,
} from "./channels";

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: unknown;
  descriptionText: string;
  status: TaskStatus;
  createdAt: Date;
  completedAt: Date | null;
  channelSlug: string;
  channelName: string;
}

const taskColumns = {
  id: tasks.id,
  projectId: tasks.projectId,
  title: tasks.title,
  description: tasks.description,
  descriptionText: tasks.descriptionText,
  status: tasks.status,
  createdAt: tasks.createdAt,
  completedAt: tasks.completedAt,
  channelSlug: projects.slug,
  channelName: projects.name,
};

function toTask(row: {
  id: string;
  projectId: string;
  title: string;
  description: unknown;
  descriptionText: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  channelSlug: string;
  channelName: string;
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
      .innerJoin(projects, eq(tasks.projectId, projects.id))
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
  if (visibleIds.length === 0) return [];

  const rows = await db
    .select(taskColumns)
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(tasks.organizationId, scope.organizationId),
        inArray(tasks.projectId, visibleIds),
      ),
    )
    .orderBy(desc(tasks.createdAt));

  return rows.map(toTask);
}

export async function createTask(
  args: ChannelScope & {
    projectId: string;
    title: string;
    description: unknown;
    descriptionText: string;
    status: TaskStatus;
  },
): Promise<Task | null> {
  const project = await requireOrgProject(args);
  if (!project) return null;

  const [inserted] = await db
    .insert(tasks)
    .values({
      organizationId: args.organizationId,
      projectId: project.id,
      title: args.title,
      description: args.description ?? null,
      descriptionText: args.descriptionText,
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
  const task = await findById(args.taskId);
  if (!task) return null;

  const project = await requireOrgProject({
    organizationId: args.organizationId,
    memberId: args.memberId,
    role: args.role,
    projectId: task.projectId,
  });
  if (!project) return null;

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

async function findById(id: string): Promise<Task | null> {
  const [row] = await db
    .select(taskColumns)
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.id, id))
    .limit(1);

  return row ? toTask(row) : null;
}

import { TRPCError } from "@trpc/server";

import { textToTiptap } from "../utils/tiptap";

import { requireOrgProject, type ChannelScope } from "./channels";
import { sendMessage } from "./messages";
import { ensureStarted } from "./sessions";
import {
  findById,
  reachableTask,
  setTaskProject,
  type Task,
} from "./tasks";

export function taskClientId(taskId: string, slotAt?: Date): string {
  return slotAt ? `task:${taskId}:${slotAt.getTime()}` : `task:${taskId}`;
}

export async function assignTask(
  args: ChannelScope & { taskId: string; projectId: string },
): Promise<Task> {
  await ensureStarted();

  const task = await reachableTask(args);
  if (!task) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "That task is not one this key can see.",
    });
  }

  if (task.threadId) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "That task already has a thread working on it. Create a new task rather than moving this one.",
    });
  }

  const project = await requireOrgProject({
    organizationId: args.organizationId,
    memberId: args.memberId,
    role: args.role,
    projectId: args.projectId,
  });
  if (!project) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "This key cannot assign work to that channel. It is private to someone else, or does not exist.",
    });
  }

  const assigned = await setTaskProject({
    taskId: task.id,
    projectId: project.id,
  });
  if (!assigned) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not record which channel took that task.",
    });
  }

  await postTask({
    organizationId: args.organizationId,
    projectId: project.id,
    authorMemberId: args.memberId,
    role: args.role,
    taskId: task.id,
    title: task.title,
  });

  return (await findById(task.id)) ?? assigned;
}

export async function postTask(args: {
  organizationId: string;
  projectId: string;
  authorMemberId: string;
  role: string;
  taskId: string;
  title: string;
  slotAt?: Date;
}): Promise<string> {
  const message = await sendMessage({
    organizationId: args.organizationId,
    projectId: args.projectId,
    authorMemberId: args.authorMemberId,
    role: args.role,
    body: textToTiptap(args.title),
    text: args.title,
    clientId: taskClientId(args.taskId, args.slotAt),
    standalone: true,
  });

  return message.id;
}

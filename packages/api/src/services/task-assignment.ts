import { db, messages } from "@roster/db";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { textToTiptap } from "../utils/tiptap";

import { allocateSeq, requireOrgProject, type ChannelScope } from "./channels";
import { emitMessageById } from "./message-events";
import { createThread, ensureStarted, startSession } from "./sessions";
import { linkTaskThread, reachableTask, type Task } from "./tasks";

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

  const rootMessageId = await postTask({
    organizationId: args.organizationId,
    projectId: project.id,
    authorMemberId: args.memberId,
    taskId: task.id,
    title: task.title,
  });

  const thread = await createThread({
    organizationId: args.organizationId,
    projectId: project.id,
    rootMessageId,
    runAsMemberId: args.memberId,
  });
  if (!thread) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not open a session in that channel.",
    });
  }

  const linked = await linkTaskThread({
    taskId: task.id,
    projectId: project.id,
    threadId: thread.id,
  });
  if (!linked) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not record which thread took that task.",
    });
  }

  await startSession({ threadId: thread.id, text: task.title });

  return linked;
}

async function postTask(args: {
  organizationId: string;
  projectId: string;
  authorMemberId: string;
  taskId: string;
  title: string;
}): Promise<string> {
  const clientId = `task:${args.taskId}`;
  const seq = await allocateSeq(args.projectId);

  const [inserted] = await db
    .insert(messages)
    .values({
      organizationId: args.organizationId,
      projectId: args.projectId,
      seq,
      authorMemberId: args.authorMemberId,
      kind: "user",
      body: textToTiptap(args.title),
      text: args.title,
      clientId,
    })
    .onConflictDoNothing({ target: [messages.projectId, messages.clientId] })
    .returning({ id: messages.id });

  if (!inserted) {
    const [existing] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.projectId, args.projectId),
          eq(messages.clientId, clientId),
        ),
      )
      .limit(1);

    if (!existing) throw new Error("Could not post the task.");
    return existing.id;
  }

  await emitMessageById(inserted.id);

  return inserted.id;
}

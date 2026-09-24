import { requireOrgProject, type ChannelScope } from "./channels";
import { assignTask } from "./task-assignment";
import { setRecurrence } from "./task-recurrence";
import { createTask, setTaskProject, type Task } from "./tasks";

export type FileTaskRefusal =
  | { reason: "not-created" }
  | { reason: "needs-channel" }
  | { reason: "no-access" }
  | { reason: "not-recorded" };

export type FileTaskResult = { task: Task } | { refused: FileTaskRefusal };

export async function fileTask(
  args: ChannelScope & {
    title: string;
    channelId?: string;
    rrule?: string;
    timezone?: string;
  },
): Promise<FileTaskResult> {
  if (args.rrule && !args.channelId) {
    return { refused: { reason: "needs-channel" } };
  }

  const task = await createTask({
    organizationId: args.organizationId,
    memberId: args.memberId,
    title: args.title,
    status: "todo",
  });
  if (!task) return { refused: { reason: "not-created" } };

  if (!args.channelId) return { task };

  if (!args.rrule) {
    return {
      task: await assignTask({
        organizationId: args.organizationId,
        memberId: args.memberId,
        role: args.role,
        taskId: task.id,
        projectId: args.channelId,
      }),
    };
  }

  const project = await requireOrgProject({
    organizationId: args.organizationId,
    memberId: args.memberId,
    role: args.role,
    projectId: args.channelId,
  });
  if (!project) return { refused: { reason: "no-access" } };

  await setTaskProject({ taskId: task.id, projectId: project.id });

  const repeating = await setRecurrence({
    taskId: task.id,
    rrule: args.rrule,
    timezone: args.timezone,
  });

  return repeating ? { task: repeating } : { refused: { reason: "not-recorded" } };
}

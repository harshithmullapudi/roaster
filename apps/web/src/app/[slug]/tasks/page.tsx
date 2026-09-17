import { listTasks } from "@roster/api";

import { AppShell } from "~/components/app-shell/app-shell";
import { TaskList } from "~/components/tasks/task-list";
import { loadShell } from "~/lib/shell";

export default async function TasksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { organization, member, shell } = await loadShell(slug);

  const tasks = await listTasks({
    organizationId: organization.id,
    memberId: member.id,
    role: member.role,
  });

  return (
    <AppShell shell={shell} section="tasks" title="Tasks" flush>
      <TaskList tasks={tasks} />
    </AppShell>
  );
}

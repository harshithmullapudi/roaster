import { listChannels } from "@roster/api";

import { AppShell } from "~/components/app-shell/app-shell";
import { myOrganizations, requireOrg } from "~/lib/session";

export default async function MyTasksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { session, organization, member } = await requireOrg(slug);

  const [organizations, channels] = await Promise.all([
    myOrganizations(session.user.id),
    listChannels({ organizationId: organization.id, memberId: member.id }),
  ]);

  return (
    <AppShell
      activeOrg={organization}
      organizations={organizations}
      user={session.user}
      section="tasks"
      channels={channels}
      title="My tasks"
    >
      <div className="border-border rounded-md border border-dashed p-6">
        <p className="text-sm font-medium">No tasks yet</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Tasks assigned to you across every channel will land here.
        </p>
      </div>
    </AppShell>
  );
}

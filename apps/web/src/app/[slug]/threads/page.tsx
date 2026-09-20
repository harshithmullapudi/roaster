import { listInboxThreads } from "@roster/api";

import { AppShell } from "~/components/app-shell/app-shell";
import { ThreadInbox } from "~/components/threads/thread-inbox";
import { loadShell } from "~/lib/shell";

export default async function ThreadsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { organization, member, shell } = await loadShell(slug);

  const threads = await listInboxThreads({
    organizationId: organization.id,
    memberId: member.id,
    role: member.role,
  });

  return (
    <AppShell shell={shell} section="threads" title="Threads" flush>
      <ThreadInbox threads={threads} orgSlug={slug} />
    </AppShell>
  );
}

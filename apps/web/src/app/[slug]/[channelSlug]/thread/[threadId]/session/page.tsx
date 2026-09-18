import { getChannelBySlug, listWorktrees } from "@roster/api";
import { notFound } from "next/navigation";

import { SessionScreen } from "~/components/terminals/session-screen";
import { requireOrg } from "~/lib/session";

export default async function ThreadSessionPage({
  params,
}: {
  params: Promise<{ slug: string; channelSlug: string; threadId: string }>;
}) {
  const { slug, channelSlug, threadId } = await params;
  const { organization, member } = await requireOrg(slug);

  const channel = await getChannelBySlug({
    organizationId: organization.id,
    memberId: member.id,
    role: member.role,
    slug: channelSlug,
  });
  if (!channel) notFound();

  const worktrees = await listWorktrees(channel.id);
  const worktree = worktrees.find((entry) => entry.threadId === threadId);
  if (!worktree) notFound();

  const threads = worktrees.map((entry) => ({
    threadId: entry.threadId,
    label: entry.label.split("\n")[0]?.trim() || "Untitled",
  }));

  return (
    <SessionScreen
      orgSlug={organization.slug}
      channelSlug={channel.slug}
      projectId={channel.id}
      workspaceId={worktree.workspaceId}
      threadId={threadId}
      threads={threads}
      backHref={`/${organization.slug}/${channel.slug}?thread=${threadId}`}
    />
  );
}

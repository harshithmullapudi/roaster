import { listChannels } from "@roster/api";
import { Button } from "@roster/ui";
import Link from "next/link";

import { AppShell } from "~/components/app-shell/app-shell";
import { ChannelList } from "~/components/channels/channel-list";
import { myOrganizations, requireOrg } from "~/lib/session";

export default async function TeamHomePage({
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

  const all = [...channels.starred, ...channels.public, ...channels.private];

  return (
    <AppShell
      activeOrg={organization}
      organizations={organizations}
      user={session.user}
      section="channels"
      channels={channels}
      title="Channels"
      actions={
        all.length > 0 ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/onboarding?step=projects">Add</Link>
          </Button>
        ) : null
      }
    >
      {all.length === 0 ? (
        <div className="border-border rounded-md border border-dashed p-6">
          <p className="text-sm font-medium">No channels yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Channels come from your Superset projects.
          </p>
          <Button size="lg" className="mt-3" asChild>
            <Link href="/onboarding?step=projects">Pick projects</Link>
          </Button>
        </div>
      ) : (
        <ChannelList orgSlug={organization.slug} channels={all} />
      )}
    </AppShell>
  );
}

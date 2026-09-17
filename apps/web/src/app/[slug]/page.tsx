import { listOrgProjects } from "@roster/api";
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
  const { session, organization } = await requireOrg(slug);

  const [organizations, projects] = await Promise.all([
    myOrganizations(session.user.id),
    listOrgProjects(organization.id),
  ]);

  return (
    <AppShell
      activeOrg={organization}
      organizations={organizations}
      user={session.user}
      section="channels"
      title="Channels"
      actions={
        projects.length > 0 ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/onboarding?step=projects">Add</Link>
          </Button>
        ) : null
      }
    >
      {projects.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed p-6">
          <p className="text-sm font-medium">No channels yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Channels come from your Superset projects.
          </p>
          <Button size="lg" className="mt-3" asChild>
            <Link href="/onboarding?step=projects">Pick projects</Link>
          </Button>
        </div>
      ) : (
        <ChannelList projects={projects} />
      )}
    </AppShell>
  );
}

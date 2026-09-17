import { listOrgProjects } from "@roster/api";
import { Button } from "@roster/ui";
import Link from "next/link";

import { ChannelList } from "~/components/channels/channel-list";
import { AppSidebar } from "~/components/sidebar/app-sidebar";
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
    <div className="flex h-screen">
      <AppSidebar
        activeOrg={organization}
        organizations={organizations}
        user={session.user}
        section="channels"
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-8 py-7">
          <h1 className="mb-4 text-base font-semibold tracking-tight">
            Channels
          </h1>

          {projects.length === 0 ? (
            <div className="border-border rounded-lg border p-5 text-center">
              <p className="text-muted-foreground text-sm">No channels yet</p>
              <Button size="lg" className="mt-3" asChild>
                <Link href="/onboarding?step=projects">Pick projects</Link>
              </Button>
            </div>
          ) : (
            <ChannelList projects={projects} />
          )}
        </div>
      </main>
    </div>
  );
}

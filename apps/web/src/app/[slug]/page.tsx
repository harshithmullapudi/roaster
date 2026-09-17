import { AppSidebar } from "~/components/app-sidebar";
import { myOrganizations, requireOrg } from "~/lib/session";

export default async function TeamHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { session, organization } = await requireOrg(slug);
  const organizations = await myOrganizations(session.user.id);

  return (
    <div className="flex h-screen">
      <AppSidebar
        activeOrg={organization}
        organizations={organizations}
        user={session.user}
        currentPath="home"
      />
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold tracking-tight">
            {organization.name}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Channels land here. For now, invite the people you work with — a
            channel with nobody in it is not much of a channel.
          </p>
        </div>
      </main>
    </div>
  );
}

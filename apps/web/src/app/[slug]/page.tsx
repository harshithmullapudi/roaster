import { redirect } from "next/navigation";

import { loadShell } from "~/lib/shell";

export default async function TeamHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { organization, shell } = await loadShell(slug);
  const { channels } = shell;

  const first =
    channels.starred[0] ?? channels.public[0] ?? channels.private[0] ?? null;

  redirect(
    first
      ? `/${organization.slug}/${first.slug}`
      : `/${organization.slug}/settings/hosts`,
  );
}

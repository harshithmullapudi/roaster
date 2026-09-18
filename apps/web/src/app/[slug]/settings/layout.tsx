import type { ReactNode } from "react";

import { SettingsShell } from "~/components/settings/settings-shell";
import { loadShell } from "~/lib/shell";

export default async function SettingsLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: ReactNode;
}) {
  const { slug } = await params;
  const { organization } = await loadShell(slug);

  return <SettingsShell orgSlug={organization.slug}>{children}</SettingsShell>;
}

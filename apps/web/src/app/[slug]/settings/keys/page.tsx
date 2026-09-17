import { AppShell } from "~/components/app-shell/app-shell";
import { ApiKeyManager } from "~/components/settings/api-key-manager";
import { loadShell } from "~/lib/shell";

export default async function ApiKeysPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { shell } = await loadShell(slug);

  return (
    <AppShell shell={shell} section="members" title="API keys">
      <ApiKeyManager />
    </AppShell>
  );
}

import { ApiKeyManager } from "~/components/settings/api-key-manager";
import { SettingsPage } from "~/components/settings/settings-page";

export default function ApiKeysPage() {
  return (
    <SettingsPage
      title="API keys"
      description="Keys the roster CLI uses to speak for you from a machine."
    >
      <ApiKeyManager />
    </SettingsPage>
  );
}

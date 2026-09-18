import {
  AgentNameSetting,
  NameSetting,
} from "~/components/settings/profile-settings";
import {
  SettingsCard,
  SettingsPage,
  SettingsSection,
} from "~/components/settings/settings-page";
import { ThemeSetting } from "~/components/settings/theme-setting";
import { loadShell } from "~/lib/shell";

export default async function PreferencesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { session, organization, member } = await loadShell(slug);

  return (
    <SettingsPage title="Preferences">
      <SettingsSection title="Profile">
        <SettingsCard>
          <NameSetting initialName={session.user.name ?? ""} />
          <AgentNameSetting
            initialName={member.agentName ?? ""}
            exampleChannel={organization.slug}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Interface and theme">
        <SettingsCard>
          <ThemeSetting />
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}

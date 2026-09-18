import { ChannelPicker } from "~/components/channels/channel-picker";
import {
  SettingsPage,
  SettingsSection,
} from "~/components/settings/settings-page";
import { SupersetConnectionSettings } from "~/components/settings/superset-connection";

export default function HostsPage() {
  return (
    <SettingsPage
      title="Hosts & channels"
      description="Your machines, and the projects on them that this workspace talks to."
    >
      <SettingsSection title="Superset">
        <SupersetConnectionSettings />
      </SettingsSection>

      <SettingsSection
        title="Channels"
        description="Tick a project to add it as a channel. The ones already added are marked."
      >
        <ChannelPicker addLabel="Add channels" />
      </SettingsSection>
    </SettingsPage>
  );
}

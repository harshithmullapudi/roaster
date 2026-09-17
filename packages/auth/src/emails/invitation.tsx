import { Text } from "@react-email/components";

import { EmailLayout, emailText } from "./layout";

export interface InvitationEmailProps {
  inviterName: string;
  organizationName: string;
  url: string;
  expiresInDays: number;
}

export function InvitationEmail({
  inviterName,
  organizationName,
  url,
  expiresInDays,
}: InvitationEmailProps) {
  return (
    <EmailLayout
      preview={`${inviterName} invited you to ${organizationName} on Roster`}
      heading={`Join ${organizationName}`}
      action={{ label: "Accept invitation", href: url }}
      footer={`This invitation expires in ${expiresInDays} days. If you weren't expecting it, you can ignore this email.`}
    >
      <Text style={emailText}>
        {inviterName} invited you to join <strong>{organizationName}</strong> on
        Roster.
      </Text>
    </EmailLayout>
  );
}

export default InvitationEmail;

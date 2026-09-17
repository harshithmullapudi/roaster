import { Text } from "@react-email/components";

import { EmailLayout, emailText } from "./layout";

export interface MagicLinkEmailProps {
  url: string;
  expiresInMinutes: number;
}

export function MagicLinkEmail({ url, expiresInMinutes }: MagicLinkEmailProps) {
  return (
    <EmailLayout
      preview="Your sign-in link for Roster"
      heading="Sign in to Roster"
      action={{ label: "Sign in", href: url }}
      footer={`This link expires in ${expiresInMinutes} minutes and can be used once. If you didn't ask to sign in, you can ignore this email.`}
    >
      <Text style={emailText}>
        Click the button below to sign in. No password needed.
      </Text>
    </EmailLayout>
  );
}

export default MagicLinkEmail;

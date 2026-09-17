import type { ReactElement } from "react";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "Roster <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

export interface SendEmailArgs {
  to: string;
  subject: string;
  react: ReactElement;
  /**
   * The link the email exists to deliver. Printed to the console when no
   * Resend key is configured, so magic-link auth is developable without an
   * email account wired up — which matters, because magic link is the only
   * way into Roster.
   */
  link: string;
}

export async function sendEmail({ to, subject, react, link }: SendEmailArgs) {
  if (!resend) {
    console.info(
      [
        "",
        "┌─ email not sent: RESEND_API_KEY is unset ─────────────",
        `│ to:      ${to}`,
        `│ subject: ${subject}`,
        `│ link:    ${link}`,
        "└───────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return;
  }

  const { error } = await resend.emails.send({ from, to, subject, react });
  // Never include the link in a thrown error: error payloads get logged and
  // forwarded, and a magic link in a log is a sign-in for whoever reads it.
  if (error) {
    throw new Error(`Failed to send "${subject}" to ${to}: ${error.message}`);
  }
}

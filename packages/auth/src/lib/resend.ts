import type { ReactElement } from "react";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "Roster <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

export interface SendEmailArgs {
  to: string;
  subject: string;
  react: ReactElement;
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
  if (error) {
    throw new Error(`Failed to send "${subject}" to ${to}: ${error.message}`);
  }
}

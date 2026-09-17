import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

const styles = {
  body: {
    backgroundColor: "#f6f6f6",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    margin: 0,
    padding: "32px 0",
  },
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #e8e8e8",
    borderRadius: "8px",
    margin: "0 auto",
    maxWidth: "440px",
    padding: "32px",
  },
  wordmark: {
    color: "#202020",
    fontSize: "15px",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    margin: "0 0 24px",
  },
  heading: {
    color: "#202020",
    fontSize: "20px",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    margin: "0 0 12px",
  },
  text: {
    color: "#646464",
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 20px",
  },
  button: {
    backgroundColor: "#0381e9",
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: 500,
    padding: "10px 18px",
    textDecoration: "none",
  },
  hr: { borderColor: "#e8e8e8", margin: "28px 0 16px" },
  footer: { color: "#8d8d8d", fontSize: "12px", lineHeight: "18px", margin: 0 },
} as const;

export interface EmailLayoutProps {
  preview: string;
  heading: string;
  children: ReactNode;
  action: { label: string; href: string };
  footer: string;
}

export function EmailLayout({
  preview,
  heading,
  children,
  action,
  footer,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.wordmark}>Roster</Text>
          <Text style={styles.heading}>{heading}</Text>
          {children}
          <Section>
            <Button style={styles.button} href={action.href}>
              {action.label}
            </Button>
          </Section>
          <Hr style={styles.hr} />
          <Text style={styles.footer}>{footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailText = styles.text;

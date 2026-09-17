import type { Metadata } from "next";

import { ThemeProvider } from "~/components/theme/theme-provider";

import "./theme.css";

export const metadata: Metadata = {
  title: "Roster",
  description: "Superset, multiplayer.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background-2 text-foreground min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";

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
        {children}
      </body>
    </html>
  );
}

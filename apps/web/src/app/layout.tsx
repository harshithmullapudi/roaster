import type { Metadata, Viewport } from "next";

import { QueryProvider } from "~/components/providers/query-provider";
import { Toaster } from "~/components/providers/toaster";
import { ThemeProvider } from "~/components/theme/theme-provider";

import "./theme.css";

export const metadata: Metadata = {
  title: "Roster",
  description: "Superset, multiplayer.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background-2 text-foreground min-h-dvh antialiased">
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

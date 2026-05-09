import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// Phase 8 — see apps/landing/app/layout.tsx for the metadataBase
// rationale. The dashboard's title.template gives every per-route page
// (Overview / Policies / Treasury / Settings / Action detail) a
// consistent title shape: "Overview | Quartermaster Dashboard".
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://quartermaster-dashboard.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Quartermaster Dashboard — watch the daemon work",
    template: "%s | Quartermaster Dashboard",
  },
  description:
    "Live operational interface for your agent fleet. Real-time runway, every burn-rate-oracle decision, every top-up tx hash. Polls a local daemon by default; targets a Railway daemon when deployed.",
  applicationName: "Quartermaster Dashboard",
  authors: [{ name: "winsznx", url: "https://github.com/winsznx" }],
  keywords: [
    "x402",
    "AI agents",
    "agent treasury",
    "Zerion CLI",
    "Base mainnet",
    "fleet runway",
    "burn-rate-oracle",
    "Quartermaster",
  ],
  openGraph: {
    type: "website",
    siteName: "Quartermaster Dashboard",
    url: SITE_URL,
    title: "Quartermaster Dashboard",
    description:
      "Watch the daemon work — live fleet runway, every policy decision, every top-up tx hash.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quartermaster Dashboard",
    description:
      "Watch the daemon work — live fleet runway, every policy decision, every top-up tx hash.",
  },
  icons: {
    icon: [{ url: "/icon", type: "image/svg+xml" }],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  alternates: { canonical: SITE_URL },
};

import { ShellLayout } from "@/components/shell-layout";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          <ShellLayout>
            {children}
          </ShellLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}

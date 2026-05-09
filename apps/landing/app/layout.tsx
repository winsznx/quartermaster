import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

// Phase 8 — link previews on social platforms hit metadataBase first to
// resolve relative og:image URLs. NEXT_PUBLIC_SITE_URL lets a self-hoster
// override; the default points at the canonical Vercel landing URL so an
// uncloned operator gets correct preview cards out of the box.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://quartermaster-landing.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Quartermaster — keep your agents solvent",
    template: "%s | Quartermaster",
  },
  description:
    "Autonomous treasury daemon for x402-paying AI agents. Watches the fleet, projects runway, tops up from the principal's yield positions — within five composable on-chain policies. Live on Base mainnet.",
  applicationName: "Quartermaster",
  authors: [{ name: "winsznx", url: "https://github.com/winsznx" }],
  keywords: [
    "x402",
    "AI agents",
    "agent treasury",
    "Zerion CLI",
    "Base mainnet",
    "USDC payments",
    "agent solvency",
    "Colosseum Frontier hackathon",
  ],
  openGraph: {
    type: "website",
    siteName: "Quartermaster",
    url: SITE_URL,
    title: "Quartermaster — keep your agents solvent",
    description:
      "Autonomous treasury daemon for x402-paying AI agents. Five composable policies. Live on Base mainnet.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quartermaster — keep your agents solvent",
    description:
      "Autonomous treasury daemon for x402-paying AI agents. Five composable policies. Live on Base mainnet.",
  },
  icons: {
    icon: [{ url: "/icon", type: "image/svg+xml" }],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  alternates: { canonical: SITE_URL },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body 
        className="min-h-full flex flex-col relative bg-bg selection:bg-accent/20 selection:text-accent overflow-x-hidden antialiased"
        suppressHydrationWarning
      >
        <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {/* Hatch layer — sits behind everything */}
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 28px,
              rgba(201, 169, 97, 0.025) 28px,
              rgba(201, 169, 97, 0.025) 29px
            )`,
            pointerEvents: 'none',
          }} />
          
          {/* All page content sits above the hatch */}
          <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}

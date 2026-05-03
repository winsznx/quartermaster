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

export const metadata: Metadata = {
  title: "Quartermaster | Keep your agents solvent",
  description: "Autonomous treasury agent for the machine economy.",
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

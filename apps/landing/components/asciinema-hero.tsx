"use client";

/**
 * Asciinema cast embed for the landing hero.
 *
 * Uses the upstream `asciinema-player` package via CDN — no React wrapper,
 * no bundler. Boots the player against `castUrl` once the CDN script loads.
 * If the CDN script fails or the cast is unreachable, the parent's static
 * terminal fallback (rendered via `children` after this component) remains
 * visible because we render into our own div without unmounting siblings.
 *
 * The Phase 7b cast file lives at `apps/landing/public/hero.cast`. The
 * server component above this file checks `existsSync` at render time and
 * only mounts <AsciinemaHero> if the cast is committed; otherwise the
 * static terminal block renders directly.
 */

import { useEffect, useRef } from "react";
import Script from "next/script";

const CDN_JS = "https://cdn.jsdelivr.net/npm/asciinema-player@3.8.0/dist/bundle/asciinema-player.min.js";
const CDN_CSS = "https://cdn.jsdelivr.net/npm/asciinema-player@3.8.0/dist/bundle/asciinema-player.css";

declare global {
  interface Window {
    AsciinemaPlayer?: {
      create: (
        src: string,
        target: HTMLElement,
        opts?: {
          autoPlay?: boolean;
          loop?: boolean;
          theme?: string;
          fit?: string | false;
          rows?: number;
          cols?: number;
          terminalFontFamily?: string;
          poster?: string;
        },
      ) => unknown;
    };
  }
}

export function AsciinemaHero({ castUrl }: { castUrl: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let player: unknown = null;

    function tryMount() {
      if (cancelled) return;
      if (!window.AsciinemaPlayer || !ref.current) return;
      try {
        player = window.AsciinemaPlayer.create(castUrl, ref.current, {
          autoPlay: true,
          loop: true,
          theme: "monokai",
          fit: "width",
          terminalFontFamily: "var(--font-jetbrains-mono), monospace",
        });
      } catch {
        // CDN loaded but cast fetch failed — leave the div empty so the
        // parent's siblings (if any) remain visible.
      }
    }

    // The Script component fires onLoad once; we also poll briefly in case
    // the script was already cached and onLoad fired before this effect ran.
    if (window.AsciinemaPlayer) {
      tryMount();
    } else {
      const timer = window.setInterval(() => {
        if (window.AsciinemaPlayer) {
          window.clearInterval(timer);
          tryMount();
        }
      }, 50);
      // Stop polling after 5s — CDN clearly isn't loading.
      window.setTimeout(() => window.clearInterval(timer), 5_000);
    }

    return () => {
      cancelled = true;
      // asciinema-player exposes a `.dispose()` method on the returned object.
      if (player && typeof (player as { dispose?: () => void }).dispose === "function") {
        (player as { dispose: () => void }).dispose();
      }
    };
  }, [castUrl]);

  return (
    <>
      <link rel="stylesheet" href={CDN_CSS} />
      <Script src={CDN_JS} strategy="afterInteractive" />
      <div
        ref={ref}
        className="w-full max-w-[800px] min-h-[300px] md:min-h-[460px] rounded-[8px] overflow-hidden border border-border-strong shadow-[0_24px_64px_rgba(0,0,0,0.4)]"
        aria-label="Quartermaster daemon driving the Phase 7a end-to-end run"
      />
    </>
  );
}

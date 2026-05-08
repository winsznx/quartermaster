import { existsSync } from "node:fs";
import { join } from "node:path";

import { Activity, CircleDollarSign, PlayCircle, Shield, Timer, TrendingDown } from "lucide-react";

import { AsciinemaHero } from "@/components/asciinema-hero";

// Motion budget per FRONTEND_BRIEF: 160ms transitions, no parallax, no
// auto-playing animations. The earlier framer-motion implementation
// (scroll-triggered reveals, 4-second terminal cycle, 500-800ms entrances)
// violated all three. This page renders the final state statically;
// any per-element transitions live in CSS via Tailwind's `transition-*`
// utilities and never exceed 160ms.
//
// Phase 7b graceful asset fallbacks: the hero terminal swaps to an
// asciinema-player embed iff `public/hero.cast` is committed; the demo
// section swaps to a <video> iff `public/demo.mp4` is committed. Both
// checks run at build/render time on the server, so the next deploy after
// the operator drops either file auto-renders the real asset.

const PUBLIC_DIR = join(process.cwd(), "public");
const HERO_CAST_PATH = join(PUBLIC_DIR, "hero.cast");
const DEMO_VIDEO_PATH = join(PUBLIC_DIR, "demo.mp4");

export default function LandingPage() {
  const headingWords = "Keep your agents solvent.".split(" ");
  const hasHeroCast = existsSync(HERO_CAST_PATH);
  const hasDemoVideo = existsSync(DEMO_VIDEO_PATH);

  return (
    <>
      <header className="w-full flex justify-center pt-8 pb-4 px-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full text-accent opacity-90">
              {[...Array(24)].map((_, i) => {
                const angle = (i * 360) / 24;
                const length = 42;
                const x2 = Number((50 + length * Math.cos((angle * Math.PI) / 180)).toFixed(3));
                const y2 = Number((50 + length * Math.sin((angle * Math.PI) / 180)).toFixed(3));
                return (
                  <line
                    key={i}
                    x1="50" y1="50" x2={x2} y2={y2}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                );
              })}
              <circle cx="50" cy="50" r="8" fill="var(--color-bg)" />
              <text x="50" y="54" textAnchor="middle" fontSize="14" fontWeight="600" fill="currentColor" fontFamily="var(--font-sans)">d</text>
            </svg>
          </div>
          <span className="font-mono text-[11px] tracking-[0.2em] text-text-muted uppercase pt-1">Quartermaster</span>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        {/* Section 1 — Hero */}
        <section id="hero" className="flex flex-col items-center px-[48px] pt-[64px] pb-[72px] gap-8 max-w-[1200px] mx-auto text-center">
          <div className="w-full max-w-[800px] flex flex-col items-center gap-6">
            <h1 className="font-display text-5xl md:text-[80px] leading-[1.1] font-normal text-text-primary hero-heading flex flex-wrap justify-center gap-[0.25em]">
              {headingWords.map((word, i) => (
                <span key={i}>{word}</span>
              ))}
            </h1>

            <p className="text-text-secondary text-xl max-w-2xl">
              Quartermaster is an autonomous treasury agent that funds your AI agent fleet — within cryptographic policy bounds, 24/7.
            </p>

            <p className="font-mono mono-lead text-text-muted mt-2">
              Live on Base. Five composable policies. Signs only what they permit.
            </p>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8 w-full">
              <a href="https://github.com/winsznx/quartermaster" className="w-fit bg-accent text-text-inverse px-8 py-3 rounded-[6px] font-medium hover:bg-accent-hover transition-colors duration-150 inline-block text-center">
                View on GitHub
              </a>
              <a href="https://github.com/winsznx/quartermaster#264-live-demo--base-mainnet-transactions" className="w-fit border border-accent text-accent px-8 py-3 rounded-[6px] font-medium hover:bg-surface-2 transition-colors duration-150 inline-block text-center">
                See on-chain hashes
              </a>
            </div>
          </div>

          <div className="w-[calc(100%+48px)] md:w-full flex items-center justify-center md:px-4 overflow-hidden">
            {hasHeroCast ? (
              <AsciinemaHero castUrl="/hero.cast" />
            ) : (
              <div className="w-full max-w-[800px] min-h-[300px] md:min-h-[460px] bg-[#0B0D0E] border border-border-strong rounded-[8px] shadow-[0_24px_64px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col font-mono text-[8.5px] sm:text-[12px] md:text-[14px] leading-relaxed text-left">
                <div className="bg-surface-2 px-3 py-2 md:px-4 md:py-3 border-b border-border-strong flex items-center relative">
                  <div className="flex gap-2">
                    <div className="w-[10px] h-[10px] md:w-[12px] md:h-[12px] rounded-full bg-[#ED6A5E]" />
                    <div className="w-[10px] h-[10px] md:w-[12px] md:h-[12px] rounded-full bg-[#F4BF4F]" />
                    <div className="w-[10px] h-[10px] md:w-[12px] md:h-[12px] rounded-full bg-[#61C554]" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-text-muted text-[9px] md:text-[13px]">
                    zerion — fleet status
                  </div>
                </div>
                <div className="p-3 md:p-10 text-text-primary whitespace-pre overflow-x-auto flex-1 flex flex-col justify-center">
                  <div className="inline-block text-left min-w-fit">
                    <div><span className="text-accent">$</span> zerion fleet status</div>
                    <div><br/></div>
                    <div className="text-text-muted">  WALLET                 BALANCE        BURN/H        RUNWAY</div>
                    <div className="text-border-strong">  ──────────────────────────────────────────────────────────</div>
                    <div>  alpha-1                $0.020         0.036         <span className="text-warning">0.4h ⚠</span></div>
                    <div>  alpha-2                $0.003         0.039         <span className="text-warning">0.1h ⚠</span></div>
                    <div>  alpha-3                $0.300         0.000         <span className="text-success">∞ ✓</span></div>
                    <div><br/></div>
                    <div className="text-warning">  → alpha-2 burn 22.13× the 7d baseline</div>
                    <div className="text-danger">  → BLOCKED by burn-rate-oracle: BURN_RATE_ANOMALY_DETECTED</div>
                    <div className="text-success">  ✓ topup_confirmed — 0x3f86…9422 (alpha-1, Base mainnet)</div>
                    <div><br/></div>
                    <div>$ <span className="opacity-60">_</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="section-divider">◆</div>

        {/* Section 2 — The Problem */}
        <section id="problem" className="py-[64px] px-[48px] max-w-[760px] mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[1px] bg-accent" />
            <span className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase">The Problem</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-normal mb-[32px] text-text-primary">
            Agents run dry. Capital sits idle.
          </h2>

          <div className="space-y-[36px]">
            {[
              {
                num: "1",
                label: "01",
                headline: "Agents run on USDC. USDC runs out.",
                body: "x402 is an open protocol that lets AI agents pay for API calls with USDC, per request. Each subordinate agent holds a small wallet balance on Base. When it empties, the agent stops — often mid-task, with no alert.",
              },
              {
                num: "2",
                label: "02",
                headline: "The capital is there. It just isn't working.",
                body: "The principal earns yield on other positions — staked ETH, Aave USDC, sDAI — that could fund the fleet but doesn't. The capital sits idle. The wallets run dry.",
              },
              {
                num: "3",
                label: "03",
                headline: "Quartermaster closes the loop.",
                body: "Today this is a spreadsheet and a reminder. Quartermaster automates it: continuous watch, policy-gated execution, no manual topping up, no forgotten agents.",
                isResolution: true,
              },
            ].map((item, i) => (
              <div key={item.num} className="grid grid-cols-1 md:grid-cols-[60px_1fr] items-start">
                <div className="hidden md:flex flex-col items-center h-full relative min-h-[100px]">
                  {i === 0 && <div className="absolute top-[18px] bottom-[-36px] w-[1px] bg-border-strong" />}
                  {i === 1 && <div className="absolute top-0 bottom-[-36px] w-[1px] bg-border-strong" />}
                  {i === 2 && <div className="absolute top-0 h-[18px] w-[1px] bg-border-strong" />}
                  <div className="relative z-10 pt-[2px]">
                    <div className="w-[32px] h-[32px] rounded-full border border-accent bg-bg flex items-center justify-center font-mono text-[12px] text-accent">
                      {item.num}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="block md:hidden font-mono text-[12px] text-accent mb-2">
                    {item.label}
                  </div>
                  <div>
                    <h3 className={`font-sans text-[16px] font-medium mb-[24px] ${item.isResolution ? "text-accent" : "text-text-primary"}`}>
                      {item.headline}
                    </h3>
                    <p className="font-sans text-[15px] text-text-secondary leading-[1.7]">
                      {item.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="section-divider">◆</div>

        {/* Section 3 — Architecture */}
        <section id="architecture" className="py-[64px] px-[48px] max-w-[1100px] mx-auto">
          <h2 className="font-sans text-[28px] font-medium mb-[32px] text-center text-text-primary">How It Works</h2>
          <div className="w-full flex items-center justify-center overflow-x-auto pb-4">
            <div className="w-full max-w-3xl flex justify-center">
              <svg viewBox="0 0 800 500" className="w-full h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="300" y="20" width="200" height="60" fill="var(--color-surface-2)" stroke="var(--color-border-strong)" />
                <text x="400" y="55" fill="var(--color-text-primary)" fontFamily="var(--font-jetbrains-mono)" fontSize="14" textAnchor="middle">PRINCIPAL</text>

                <rect x="250" y="150" width="300" height="80" fill="var(--color-surface-2)" stroke="var(--color-border-strong)" />
                <text x="400" y="175" fill="var(--color-text-primary)" fontFamily="var(--font-jetbrains-mono)" fontSize="14" textAnchor="middle">QUARTERMASTER DAEMON</text>
                <text x="310" y="210" fill="var(--color-text-muted)" fontFamily="var(--font-jetbrains-mono)" fontSize="12" textAnchor="middle">Watcher</text>
                <text x="400" y="210" fill="var(--color-text-muted)" fontFamily="var(--font-jetbrains-mono)" fontSize="12" textAnchor="middle">Decider</text>
                <text x="490" y="210" fill="var(--color-text-muted)" fontFamily="var(--font-jetbrains-mono)" fontSize="12" textAnchor="middle">Executor</text>

                <rect x="20" y="160" width="150" height="60" fill="var(--color-surface-2)" stroke="var(--color-border-strong)" />
                <text x="95" y="195" fill="var(--color-text-primary)" fontFamily="var(--font-jetbrains-mono)" fontSize="14" textAnchor="middle">Zerion API</text>

                <rect x="580" y="160" width="200" height="60" fill="var(--color-surface-2)" stroke="var(--color-border-strong)" />
                <text x="680" y="195" fill="var(--color-text-primary)" fontFamily="var(--font-jetbrains-mono)" fontSize="14" textAnchor="middle">Forked Zerion CLI</text>

                <rect x="300" y="320" width="200" height="60" fill="var(--color-surface-2)" stroke="var(--color-border-strong)" />
                <text x="400" y="355" fill="var(--color-text-primary)" fontFamily="var(--font-jetbrains-mono)" fontSize="14" textAnchor="middle">BASE MAINNET</text>

                <rect x="580" y="420" width="200" height="60" fill="var(--color-surface-2)" stroke="var(--color-border-strong)" />
                <text x="680" y="455" fill="var(--color-text-primary)" fontFamily="var(--font-jetbrains-mono)" fontSize="14" textAnchor="middle">SUBORDINATE WALLETS</text>

                <path d="M400 80 L400 148" stroke="var(--color-accent)" strokeWidth="2" markerEnd="url(#arrow)" />
                <path d="M170 190 L248 190" stroke="var(--color-accent)" strokeWidth="2" markerEnd="url(#arrow)" />
                <path d="M550 190 L578 190" stroke="var(--color-accent)" strokeWidth="2" markerEnd="url(#arrow)" />
                <path d="M400 230 L400 318" stroke="var(--color-accent)" strokeWidth="2" markerEnd="url(#arrow)" />
                <path d="M400 380 L400 450 L578 450" stroke="var(--color-accent)" strokeWidth="2" fill="none" markerEnd="url(#arrow)" />

                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" />
                  </marker>
                </defs>
              </svg>
            </div>
          </div>
        </section>

        <div className="section-divider">◆</div>

        {/* Section 4 — Five Policies */}
        <section id="policies" className="py-[64px] px-[48px] max-w-[1100px] mx-auto">
          <h2 className="font-sans text-[28px] font-medium mb-2 text-center text-text-primary">Five Composable Policies</h2>
          <p className="text-text-secondary text-center mb-[32px] max-w-2xl mx-auto font-sans">
            Every action is gated by all five. Adding a policy requires zero changes to other code.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
            {[
              { id: "allowlist", title: "allowlist", icon: Shield, desc: "Destination address must be registered in the fleet. No send to unknown wallets, ever." },
              { id: "max-per-action-cap", title: "max-per-action-cap", icon: CircleDollarSign, desc: "Single top-up capped at MAX_USDC_PER_ACTION. Default $100. Prevents runaway drain in a single cycle." },
              { id: "cooldown-window", title: "cooldown-window", icon: Timer, desc: "No second top-up to the same wallet within COOLDOWN_MIN. Default 30 minutes. Forces human review on repeated drain." },
              { id: "burn-rate-oracle", title: "burn-rate-oracle", icon: Activity, desc: "Validates that burn rate reflects real sustained usage. Rejects if current hour exceeds 10× the 7-day baseline. Reason code: BURN_RATE_ANOMALY_DETECTED." },
              { id: "yield-curve-preservation", title: "yield-curve-preservation", icon: TrendingDown, desc: "Source asset must be the lowest-APY eligible position. Never liquidates stETH if idle USDC covers the top-up.", colSpan: true },
            ].map((policy) => (
              <div key={policy.id} className={`policy-card bg-surface-1 border border-border-subtle rounded-[6px] p-6 ${policy.colSpan ? "md:col-span-2" : ""}`}>
                <h3 className="font-mono text-[13px] text-accent mb-4">{policy.title}</h3>
                <div className="flex gap-6 items-start">
                  <div className="policy-icon-wrapper w-10 h-10 flex-shrink-0">
                    <policy.icon className="text-accent" size={20} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary mb-4 font-sans">{policy.desc}</p>
                    <a href="https://github.com/winsznx/quartermaster/blob/main/cli/policies" className="font-sans text-sm text-accent hover:text-accent-hover transition-colors duration-150">View source →</a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="section-divider">◆</div>

        {/* Section 5 — Built on Zerion */}
        <section id="zerion" className="py-[64px] px-[48px] max-w-[1100px] mx-auto">
          <div className="max-w-[600px] mx-auto flex flex-col items-center text-center">
            <h2 className="font-sans text-[28px] font-medium mb-[32px] text-text-primary">Built on Zerion</h2>

            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-[40px] h-px bg-accent" />
              <div className="font-sans font-medium text-[18px] text-text-primary tracking-[0.15em]">ZERION</div>
              <div className="w-[40px] h-px bg-accent" />
            </div>

            <p className="text-text-secondary mb-5 leading-relaxed">
              Every swap, bridge, and send routes through the Zerion CLI. Quartermaster is a policy and orchestration layer — not a router. Zerion stays the execution engine.
            </p>

            <a href="https://developers.zerion.io" className="inline-block border border-border-strong text-text-primary px-6 py-3 rounded-[6px] font-medium hover:bg-surface-2 transition-colors duration-150">
              Get a Zerion API key →
            </a>
          </div>
        </section>

        <div className="section-divider">◆</div>

        {/* Section 6 — Demo. Server-side checks for public/demo.mp4; renders
            <video> if present, placeholder card otherwise. The next deploy
            after the operator commits demo.mp4 auto-renders the video. */}
        <section id="demo" className="py-[64px] px-[48px] max-w-[1100px] mx-auto">
          <h2 className="font-sans text-[28px] font-medium mb-[32px] text-center text-text-primary">See It Run</h2>
          <div className="w-full max-w-[900px] mx-auto aspect-video bg-surface-1 border border-border-subtle rounded-[6px] overflow-hidden flex items-center justify-center relative shadow-lg">
            {hasDemoVideo ? (
              <video
                className="w-full h-full object-cover"
                controls
                preload="metadata"
                playsInline
                aria-label="Quartermaster demo video"
              >
                <source src="/demo.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="absolute inset-0 bg-[#0B0D0E] flex flex-col items-center justify-center text-center px-6">
                <PlayCircle size={64} strokeWidth={1} className="text-accent mb-5 opacity-80" />
                <p className="text-text-primary text-base font-medium mb-2">Demo video shipping with submission</p>
                <p className="text-text-secondary text-sm max-w-md mb-6">
                  Until then, the proof is on Base mainnet. Every transaction that drove the daemon
                  during build is linked from the README.
                </p>
                <a
                  href="https://github.com/winsznx/quartermaster#264-live-demo--base-mainnet-transactions"
                  className="inline-block bg-accent text-text-inverse px-6 py-2.5 rounded-[6px] font-medium hover:bg-accent-hover transition-colors duration-150 text-sm"
                >
                  See on-chain hashes →
                </a>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="py-[20px] px-[48px] text-center text-text-muted border-t border-accent/30 bg-transparent relative z-10">
        <div className="flex justify-center gap-6 text-[13px] font-sans">
          <a href="https://github.com/winsznx/quartermaster" className="hover:text-text-primary transition-colors duration-150">GitHub</a>
          <a href="https://github.com/winsznx/quartermaster#264-live-demo--base-mainnet-transactions" className="hover:text-text-primary transition-colors duration-150">Live tx hashes</a>
          <a href="mailto:xidoncapitals@gmail.com" className="hover:text-text-primary transition-colors duration-150">Contact</a>
        </div>
        <div className="mt-4 text-[12px] opacity-60">MIT License</div>
      </footer>
    </>
  );
}

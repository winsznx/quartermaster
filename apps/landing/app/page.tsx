"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Shield, CircleDollarSign, Timer, Activity, TrendingDown, PlayCircle } from "lucide-react";

const sectionVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }
  }
};

const wordVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const staggerCards = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } }
};

function Section({ children, id, className = "" }: { children: React.ReactNode, id: string, className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  
  return (
    <section id={id} ref={ref} className={`py-[120px] px-4 max-w-[1100px] mx-auto ${className}`}>
      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
      >
        {children}
      </motion.div>
    </section>
  );
}

export default function LandingPage() {
  const [terminalLines, setTerminalLines] = useState<number>(0);
  
  useEffect(() => {
    let timeouts: NodeJS.Timeout[] = [];
    const runTerminal = () => {
      setTerminalLines(0);
      timeouts.push(setTimeout(() => setTerminalLines(1), 300));
      timeouts.push(setTimeout(() => setTerminalLines(2), 800));
      timeouts.push(setTimeout(() => setTerminalLines(3), 1000));
      timeouts.push(setTimeout(() => setTerminalLines(4), 1100));
      timeouts.push(setTimeout(() => setTerminalLines(5), 1200));
      timeouts.push(setTimeout(() => setTerminalLines(6), 1300));
      timeouts.push(setTimeout(() => setTerminalLines(7), 1400));
      timeouts.push(setTimeout(() => setTerminalLines(8), 1500));
      timeouts.push(setTimeout(() => setTerminalLines(9), 1600));
      timeouts.push(setTimeout(() => setTerminalLines(10), 1700));
      timeouts.push(setTimeout(() => setTerminalLines(11), 1900));
      timeouts.push(setTimeout(() => setTerminalLines(12), 2100));
      timeouts.push(setTimeout(() => setTerminalLines(13), 2300));
      timeouts.push(setTimeout(() => setTerminalLines(14), 2500));
      timeouts.push(setTimeout(() => setTerminalLines(15), 2700));
      timeouts.push(setTimeout(runTerminal, 4000));
    };
    
    runTerminal();
    return () => timeouts.forEach(clearTimeout);
  }, []);

  const headingWords = "Keep your agents solvent.".split(" ");

  return (
    <>
      <header className="w-full flex justify-center pt-8 pb-4 px-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex items-center justify-center">
            {/* Custom SVG Sunburst Logo */}
            <svg viewBox="0 0 100 100" className="w-full h-full text-accent opacity-90">
              {[...Array(24)].map((_, i) => {
                const angle = (i * 360) / 24;
                const length = 35 + Math.random() * 15;
                const x2 = 50 + length * Math.cos((angle * Math.PI) / 180);
                const y2 = 50 + length * Math.sin((angle * Math.PI) / 180);
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
        <section id="hero" className="flex flex-col items-center px-4 pt-0 pb-16 gap-8 max-w-[1200px] mx-auto text-center">
          <div className="w-full max-w-[800px] flex flex-col items-center gap-6">
            <h1 className="font-display text-5xl md:text-[80px] leading-[1.1] font-normal text-text-primary hero-heading flex flex-wrap justify-center gap-[0.25em]">
              {headingWords.map((word, i) => (
                <motion.span
                  key={i}
                  variants={wordVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
                >
                  {word}
                </motion.span>
              ))}
            </h1>
            <motion.p 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-text-secondary text-xl max-w-2xl"
            >
              Quartermaster is an autonomous treasury agent that funds your AI agent fleet — within cryptographic policy bounds, 24/7.
            </motion.p>
            <motion.p 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 0.5 }}
              className="font-mono mono-lead text-text-muted mt-2"
            >
              Live on Base. Five composable policies. Signs only what they permit.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.4 }}
              className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8 w-full"
            >
              <a href="https://github.com/winsznx/quartermaster" className="w-fit bg-accent text-text-inverse px-8 py-3 rounded-[6px] font-medium hover:bg-accent-hover transition-colors inline-block text-center">
                View on GitHub
              </a>
              <a href="#" className="w-fit border border-accent text-accent px-8 py-3 rounded-[6px] font-medium hover:bg-surface-2 transition-colors inline-block text-center">
                Read the docs
              </a>
            </motion.div>
          </div>
          
          <div className="w-full flex items-center justify-center px-4 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
              className="w-full max-w-[800px] min-h-[300px] md:min-h-[460px] bg-[#0B0D0E] border border-border-strong rounded-[8px] shadow-[0_24px_64px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col font-mono text-[10px] sm:text-[12px] md:text-[14px] leading-relaxed text-left"
            >
              <div className="bg-surface-2 px-4 py-3 border-b border-border-strong flex items-center relative">
                <div className="flex gap-2">
                  <div className="w-[10px] h-[10px] md:w-[12px] md:h-[12px] rounded-full bg-[#ED6A5E]"></div>
                  <div className="w-[10px] h-[10px] md:w-[12px] md:h-[12px] rounded-full bg-[#F4BF4F]"></div>
                  <div className="w-[10px] h-[10px] md:w-[12px] md:h-[12px] rounded-full bg-[#61C554]"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-text-muted text-[10px] md:text-[13px]">
                  zerion — fleet status
                </div>
              </div>
              <div className="p-4 md:p-10 text-text-primary whitespace-pre overflow-x-auto flex-1 flex flex-col justify-center">
                <div className="inline-block text-left min-w-fit">
                  {terminalLines >= 1 && <div><span className="text-accent">$</span> zerion fleet status</div>}
                  {terminalLines >= 2 && <div><br/></div>}
                  {terminalLines >= 3 && <div className="text-text-muted">  WALLET                 BALANCE        BURN/H        RUNWAY</div>}
                  {terminalLines >= 4 && <div className="text-border-strong">  ──────────────────────────────────────────────────────────</div>}
                  {terminalLines >= 5 && <div>  alpha                  $8.12          0.58          <span className="text-warning">14h ⚠</span></div>}
                  {terminalLines >= 6 && <div>  beta                   $17.98         0.58          31h</div>}
                  {terminalLines >= 7 && <div>  gamma                  $8.00          0.17          48h</div>}
                  {terminalLines >= 8 && <div>  delta                  $5.20          0.07          <span className="text-success">72h ✓</span></div>}
                  {terminalLines >= 9 && <div>  epsilon                $3.00          0.03          <span className="text-success">120h ✓</span></div>}
                  {terminalLines >= 10 && <div><br/></div>}
                  {terminalLines >= 11 && <div className="text-warning">  → alpha runway below threshold (14h &lt; 24h)</div>}
                  {terminalLines >= 12 && <div className="text-accent">  → initiating top-up: $10.00 USDC from treasury</div>}
                  {terminalLines >= 13 && <div className="text-success">  ✓ topup_confirmed — 0xabc1…e5f6 (Base)</div>}
                  {terminalLines >= 14 && <div><br/></div>}
                  {terminalLines >= 15 && <div>$ <span className="animate-[pulse_1s_infinite]">_</span></div>}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <div className="section-divider">◆</div>

        {/* Section 2 — The Problem */}
        <section id="problem" className="py-[120px] px-4 max-w-[760px] mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="font-sans text-[28px] font-medium mb-[48px] text-text-primary"
          >
            The Problem
          </motion.h2>

          <div className="space-y-[64px]">
            {[
              {
                num: "1",
                label: "01",
                headline: "Agents run on USDC. USDC runs out.",
                body: "x402 is an open protocol that lets AI agents pay for API calls with USDC, per request. Each subordinate agent holds a small wallet balance on Base. When it empties, the agent stops — often mid-task, with no alert."
              },
              {
                num: "2",
                label: "02",
                headline: "The capital is there. It just isn't working.",
                body: "The principal earns yield on other positions — staked ETH, Aave USDC, sDAI — that could fund the fleet but doesn't. The capital sits idle. The wallets run dry."
              },
              {
                num: "3",
                label: "03",
                headline: "Quartermaster closes the loop.",
                body: "Today this is a spreadsheet and a reminder. Quartermaster automates it: continuous watch, policy-gated execution, no manual topping up, no forgotten agents.",
                isResolution: true
              }
            ].map((item, i, arr) => (
              <div key={item.num} className="grid grid-cols-1 md:grid-cols-[60px_1fr] items-start">
                {/* Timeline Node Column */}
                <div className="hidden md:flex flex-col items-center h-full relative min-h-[100px]">
                  {/* Vertical Track Segments */}
                  {i === 0 && (
                    <div className="absolute top-[18px] bottom-[-64px] w-[1px] bg-border-strong"></div>
                  )}
                  {i === 1 && (
                    <div className="absolute top-0 bottom-[-64px] w-[1px] bg-border-strong"></div>
                  )}
                  {i === 2 && (
                    <div className="absolute top-0 h-[18px] w-[1px] bg-border-strong"></div>
                  )}

                  <div className="relative z-10 pt-[2px]">
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: true, margin: "-80px" }}
                      transition={{ delay: i * 0.2, duration: 0.3, ease: "backOut" }}
                      className="w-[32px] h-[32px] rounded-full border border-accent bg-bg flex items-center justify-center font-mono text-[12px] text-accent"
                    >
                      {item.num}
                    </motion.div>
                  </div>
                </div>

                {/* Content Column */}
                <div className="flex flex-col">
                  {/* Mobile Label */}
                  <div className="block md:hidden font-mono text-[12px] text-accent mb-2">
                    {item.label}
                  </div>

                  <motion.div
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ delay: i * 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <h3 className={`font-sans text-[16px] font-medium mb-[24px] ${item.isResolution ? "text-accent" : "text-text-primary"}`}>
                      {item.headline}
                    </h3>
                    <p className="font-sans text-[15px] text-text-secondary leading-[1.7]">
                      {item.body}
                    </p>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="section-divider">◆</div>

        {/* Section 3 — Architecture */}
        <Section id="architecture">
          <h2 className="font-sans text-[28px] font-medium mb-12 text-center text-text-primary">How It Works</h2>
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
 
               <motion.path d="M400 80 L400 148" stroke="var(--color-accent)" strokeWidth="2" markerEnd="url(#arrow)" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 0.8 }} viewport={{ once: true, margin: "-80px" }} />
               <motion.path d="M170 190 L248 190" stroke="var(--color-accent)" strokeWidth="2" markerEnd="url(#arrow)" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.1 }} viewport={{ once: true, margin: "-80px" }} />
               <motion.path d="M550 190 L578 190" stroke="var(--color-accent)" strokeWidth="2" markerEnd="url(#arrow)" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.2 }} viewport={{ once: true, margin: "-80px" }} />
               <motion.path d="M400 230 L400 318" stroke="var(--color-accent)" strokeWidth="2" markerEnd="url(#arrow)" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.3 }} viewport={{ once: true, margin: "-80px" }} />
               <motion.path d="M400 380 L400 450 L578 450" stroke="var(--color-accent)" strokeWidth="2" fill="none" markerEnd="url(#arrow)" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.4 }} viewport={{ once: true, margin: "-80px" }} />
              
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)"/>
                </marker>
              </defs>
            </svg>
          </div>
        </div>
      </Section>

        <div className="section-divider">◆</div>

        {/* Section 4 — Five Policies */}
        <section id="policies" className="py-[120px] px-4 max-w-[1100px] mx-auto">
          <motion.h2 initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }} className="font-sans text-[28px] font-medium mb-2 text-center text-text-primary">Five Composable Policies</motion.h2>
          <motion.p initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6, delay: 0.1 }} className="text-text-secondary text-center mb-16 max-w-2xl mx-auto font-sans">
            Every action is gated by all five. Adding a policy requires zero changes to other code.
          </motion.p>
          
          <motion.div 
            variants={staggerCards} 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, margin: "-80px" }} 
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {[
              { id: "allowlist", title: "allowlist", icon: Shield, desc: "Destination address must be registered in the fleet. No send to unknown wallets, ever." },
              { id: "max-per-action-cap", title: "max-per-action-cap", icon: CircleDollarSign, desc: "Single top-up capped at MAX_USDC_PER_ACTION. Default $100. Prevents runaway drain in a single cycle." },
              { id: "cooldown-window", title: "cooldown-window", icon: Timer, desc: "No second top-up to the same wallet within COOLDOWN_MIN. Default 30 minutes. Forces human review on repeated drain." },
              { id: "burn-rate-oracle", title: "burn-rate-oracle", icon: Activity, desc: "Validates that burn rate reflects real sustained usage. Rejects if current hour exceeds 10× the 7-day baseline. Reason code: BURN_RATE_ANOMALY_DETECTED." },
              { id: "yield-curve-preservation", title: "yield-curve-preservation", icon: TrendingDown, desc: "Source asset must be the lowest-APY eligible position. Never liquidates stETH if idle USDC covers the top-up.", colSpan: true }
            ].map((policy) => (
              <motion.div key={policy.id} variants={itemVariants} className={`policy-card bg-surface-1 border border-border-subtle rounded-[6px] p-6 ${policy.colSpan ? "md:col-span-2" : ""}`}>
                <h3 className="font-mono text-[13px] text-accent mb-4">{policy.title}</h3>
                <div className="flex gap-4 items-start">
                  <div className="policy-icon-wrapper flex-shrink-0">
                    <policy.icon className="text-accent" size={20} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary mb-4 font-sans">{policy.desc}</p>
                    <a href="#" className="font-sans text-sm text-accent hover:text-accent-hover transition-colors">View source →</a>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <div className="section-divider">◆</div>

        {/* Section 5 — Built on Zerion */}
        <Section id="zerion">
          <div className="max-w-[600px] mx-auto flex flex-col items-center text-center">
            <h2 className="font-sans text-[28px] font-medium mb-6 text-text-primary">Built on Zerion</h2>
            
            {/* Horizontal Lockup */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-[40px] h-px bg-accent"></div>
              <div className="font-sans font-medium text-[18px] text-text-primary tracking-[0.15em]">ZERION</div>
              <div className="w-[40px] h-px bg-accent"></div>
            </div>

            <p className="text-text-secondary mb-10 leading-relaxed">
              Every swap, bridge, and send routes through the Zerion CLI. Quartermaster is a policy and orchestration layer — not a router. Zerion stays the execution engine.
            </p>
            
            <a href="https://developers.zerion.io" className="inline-block border border-border-strong text-text-primary px-6 py-3 rounded-[6px] font-medium hover:bg-surface-2 transition-colors">
              Get a Zerion API key →
            </a>
          </div>
        </Section>

        <div className="section-divider">◆</div>

        {/* Section 6 — Demo Video */}
        <Section id="demo">
          <h2 className="font-sans text-[28px] font-medium mb-12 text-center text-text-primary">See It Run</h2>
          <div className="w-full max-w-[900px] mx-auto aspect-video bg-surface-1 border border-border-subtle rounded-[6px] overflow-hidden flex items-center justify-center relative shadow-lg">
            {/* Styled poster fallback container */}
            <div className="absolute inset-0 bg-[#0B0D0E] flex flex-col items-center justify-center z-10">
              <PlayCircle size={64} strokeWidth={1} className="text-accent mb-6 opacity-80" />
              <div className="font-mono text-text-muted text-[13px] tracking-widest">Demo — 2:40</div>
            </div>
            {/* The video element with preload none so the poster displays */}
            <video className="w-full h-full object-cover relative z-0" controls preload="none">
              <source src="/demo.mp4" type="video/mp4" />
            </video>
          </div>
        </Section>
      </main>

      <footer className="py-8 text-center text-text-muted border-t border-accent/30 bg-transparent relative z-10">
        <div className="flex justify-center gap-6 text-[13px] font-sans">
          <a href="https://github.com/winsznx/quartermaster" className="hover:text-text-primary transition-colors">GitHub</a>
          <a href="#" className="hover:text-text-primary transition-colors">Colosseum Frontier</a>
          <a href="#" className="hover:text-text-primary transition-colors">@winsznx</a>
          <a href="mailto:xidoncapitals@gmail.com" className="hover:text-text-primary transition-colors">xidoncapitals@gmail.com</a>
        </div>
        <div className="mt-4 text-[12px] opacity-60">MIT License</div>
      </footer>
    </>
  );
}

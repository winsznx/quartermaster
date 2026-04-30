# Quartermaster — Frontend Brief

For the frontend developer. This is your scope, distilled from the Master PRD. Read this first; reach for the PRD when you need the full context.

---

## What you're building

Quartermaster is an autonomous treasury agent that keeps a fleet of AI agent wallets solvent. It watches their USDC balances, projects when each will run dry, and tops them up from the principal's yield-bearing positions — gated by composable on-chain policies. Built on Zerion's CLI, submitted to the Colosseum Frontier Hackathon.

You are responsible for:
1. **Landing page** — public marketing site, deploys to Vercel
2. **Dashboard** — local-only ops UI, runs alongside the daemon, polls `http://127.0.0.1:7402`

You are NOT responsible for:
- The daemon, CLI, or any blockchain logic
- The policy engine
- Any of the `cli/` or `packages/` code

You can develop the dashboard against a mock API (provided as static JSON fixtures) until the daemon is wired up.

---

## What's locked vs. what's yours

### LOCKED (don't change without asking)

- **Theme:** "Specie" — antique gold on anthracite (dark default), parchment + burnished gold (light)
- **Color tokens** — full table below; everything in CSS variables
- **Typography** — Inter (body/UI), JetBrains Mono (numerics, addresses, code), Fraunces (landing display only)
- **Stack** — Next.js 16.x latest, React 19.2+, Tailwind v4, shadcn/ui, Recharts, Lucide
- **Route map** — the URL structure
- **API contract** — the endpoint shapes the dashboard consumes
- **Brand voice** — terse, financial-ops-tool sober, no marketing puffery, no emoji in chrome
- **Spacing scale** — 4px base unit
- **Border radius** — 6px cards/inputs, 2px pills/badges, **0px tables** (no fake roundness in financial UIs)
- **Motion budget** — 160ms transitions, no parallax, no auto-playing animations, only permitted decoration is a 200ms opacity pulse on values that just updated

### YOURS (own these, surprise me)

- Page layouts beyond the Overview screen (Fleet, Treasury, Actions, Action Detail, Policies, Policy Detail, Settings)
- Empty states, loading states, error states
- First-run onboarding flow (when daemon is offline / no fleet configured)
- Microcopy — button labels, empty-state text, toast messages, error explanations
- Theme toggle placement and behavior
- Action detail timeline visualization (this is a great moment to do something interesting)
- Tx hash treatment in tables — truncation, copy-to-clipboard, Basescan deep-link
- Mobile responsiveness (target 1440+ desktop primary; reasonable down to ~768px tablet; mobile is nice-to-have)
- Recharts theming (axis style, tooltip style, gridlines)
- Asciinema embed integration on the landing hero
- Any micro-interactions that respect the motion budget

The flow is yours to design. I want this to feel like *one product*, not glued-together pages. Build connective tissue (breadcrumbs, contextual CTAs, intelligent defaults) where you see the opportunity.

---

## Color tokens

Use as CSS variables in `globals.css`. Components reference via Tailwind utilities (`bg-[var(--color-surface-1)]`) or by extending Tailwind config to expose them as `bg-surface-1` etc. Never hardcode hex.

### Dark mode (default)

```css
:root[data-theme="dark"] {
  --color-bg:              #0B0D0E;
  --color-surface-1:       #141719;
  --color-surface-2:       #1C1F22;
  --color-surface-3:       #272B2F;
  --color-border-subtle:   #2A2E32;
  --color-border-strong:   #3B4046;

  --color-text-primary:    #ECE8DE;  /* bone */
  --color-text-secondary:  #A8A39A;
  --color-text-muted:      #6B6862;
  --color-text-inverse:    #0B0D0E;

  --color-accent:          #C9A961;  /* antique gold */
  --color-accent-hover:    #D4B572;
  --color-accent-muted:    #7C683B;

  --color-success:         #6B7F5E;  /* sage */
  --color-warning:         #D4703F;  /* burnt sienna */
  --color-danger:          #8B2A26;  /* oxblood — use as fill bg only, NOT text on bg */
  --color-info:            #3A4D52;  /* slate teal */

  --chart-1: #C9A961;
  --chart-2: #6B7F5E;
  --chart-3: #3A4D52;
  --chart-4: #D4703F;
  --chart-5: #8B2A26;
  --chart-6: #A8A39A;
}
```

### Light mode

```css
:root[data-theme="light"] {
  --color-bg:              #F4F1E8;  /* parchment */
  --color-surface-1:       #FBFAF4;
  --color-surface-2:       #EDE9DC;
  --color-surface-3:       #E4DFCE;
  --color-border-subtle:   #DAD4BF;
  --color-border-strong:   #B8B09A;

  --color-text-primary:    #1A1C1E;
  --color-text-secondary:  #4A4A47;
  --color-text-muted:      #7A7770;
  --color-text-inverse:    #FBFAF4;

  --color-accent:          #8E6A1F;  /* burnished gold */
  --color-accent-hover:    #A07A28;
  --color-accent-muted:    #C4AE80;

  --color-success:         #4D5E42;
  --color-warning:         #B85A25;
  --color-danger:          #6B1F1C;
  --color-info:            #2A393E;

  --chart-1: #8E6A1F;
  --chart-2: #4D5E42;
  --chart-3: #2A393E;
  --chart-4: #B85A25;
  --chart-5: #6B1F1C;
  --chart-6: #7A7770;
}
```

### Contrast notes

- Oxblood `#8B2A26` on bg `#0B0D0E` measures ~3.1:1 — **fails AA for body text**. Use only for filled badges/pills with light text on top, or shift to `#A53A36` if you need it as foreground. Run a real check.
- All other foreground/background pairs hit AA or AAA. Verify with WebAIM or `pa11y` when you ship.

---

## Typography

| Role | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Display (landing hero only) | Fraunces (variable, opsz) | 48–72px | 400, opsz 144 | Optical sizing on |
| H1 / page headings | Inter | 28–36px | 500 | |
| H2 / section headings | Inter | 22–24px | 500 | |
| Body | Inter | 15px | 400 | |
| UI label | Inter | 13px | 500 | tracking +0.02em |
| Mono (addresses, hashes, code, terminal) | JetBrains Mono | 13–14px | 400 | |
| Numeric (stats) | Inter, `font-variant-numeric: tabular-nums` always on | varies | varies | NEVER let stats bounce |

**Rule:** Fraunces only on the landing page hero. The app stays on Inter + JetBrains Mono. Don't import Fraunces into the dashboard bundle.

---

## Stack and engineering rules

### Stack
- Next.js 16 latest stable (App Router, server components default)
- React 19.2.4+
- Tailwind v4 (CSS-first config, `@import "tailwindcss"` in globals.css)
- shadcn/ui — install via CLI, customize tokens to point at our CSS variables
- Recharts (one chart library, no others)
- Lucide React (one icon library, stroke 1.5px uniformly)
- pnpm workspace (monorepo)

### Don't add
- Framer Motion / GSAP / any animation library
- Headless UI (shadcn covers our needs)
- Any CSS-in-JS library
- date-fns full import — tree-shake what you need
- Lodash full import — write what you need

### Code rules
- TypeScript strict. No `any`. Use `unknown` and narrow.
- One component per file. Named export AND default export.
- Server components by default. Mark `'use client'` only where interaction demands.
- Props typed with explicit interfaces — no inline `{x}: {x: string}`
- CSS variables only — no hardcoded hex in components
- No inline `style=` except for truly dynamic values (chart bar widths, etc.)
- Lucide icons: stroke width 1.5px uniformly; decorative icons get `aria-hidden`; icon-only buttons get `aria-label`

### Performance budget
- Dashboard initial JS < 200KB gzipped
- Images: AVIF first, WebP fallback, never raw PNG > 50KB
- Run Lighthouse before PR — target 95+ on Performance and Accessibility for both the landing and dashboard `/overview`

---

## Files & organization

```
apps/
├── landing/                     # the marketing site
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # the only page
│   │   └── globals.css
│   ├── components/
│   └── public/                  # demo video, fonts
│
├── dashboard/                   # the ops UI
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── overview/page.tsx
│   │   ├── fleet/page.tsx
│   │   ├── fleet/[id]/page.tsx
│   │   ├── treasury/page.tsx
│   │   ├── actions/page.tsx
│   │   ├── actions/[id]/page.tsx
│   │   ├── policies/page.tsx
│   │   ├── policies/[name]/page.tsx
│   │   └── settings/page.tsx
│   ├── components/
│   │   ├── ui/                  # shadcn primitives, themed
│   │   ├── stats-card.tsx
│   │   ├── runway-chart.tsx
│   │   ├── ledger-table.tsx
│   │   ├── policy-card.tsx
│   │   ├── wallet-row.tsx
│   │   ├── daemon-status-pill.tsx
│   │   └── tx-link.tsx
│   └── lib/
│       └── daemon-client.ts     # HTTP client to local daemon

packages/
└── shared-schemas/              # zod schemas shared with daemon
```

One component per file. Co-locate tests next to the component if you write any.

---

## Routes (locked)

| URL | Purpose | Data source |
|---|---|---|
| `/` | redirect → `/overview` | — |
| `/overview` | Three KPIs + runway chart + recent actions | `GET /api/state` |
| `/fleet` | Fleet list, runway per wallet | `GET /api/fleet` |
| `/fleet/[id]` | Single subordinate detail | `GET /api/fleet/:id` |
| `/treasury` | Treasury sources, APY, balances | `GET /api/treasury` |
| `/actions` | Full ledger of top-up actions, paginated | `GET /api/actions?limit=100&before=...` |
| `/actions/[id]` | Single action timeline, all tx hashes, all policy evaluations | `GET /api/actions/:id` |
| `/policies` | All policies (5 ours + 3 upstream), pass/fail counts | `GET /api/policies` |
| `/policies/[name]` | Single policy config + evaluation history | `GET /api/policies/:name` |
| `/settings` | Read-only config view (CLI-only edits) | `GET /api/settings` |

The dashboard never POSTs/PUTs/DELETEs. Mutations are CLI-only — for any "edit" action, the UI shows the equivalent CLI command in a copyable mono block. Examples:
- Settings page: each row has a `zerion qm policy set <name> <param>=<value>` snippet to copy
- Fleet add CTA: opens a dialog showing `zerion fleet add <wallet-id> <address>` with copy button

This is intentional. The dashboard is a **viewer**. The principal's authority lives in the CLI.

---

## API contract you'll consume

All endpoints return JSON, no auth (daemon is bound to `127.0.0.1` only).

| Endpoint | Returns |
|---|---|
| `GET /api/health` | `{ status, daemonPid, startedAt, version }` |
| `GET /api/state` | aggregate Overview state, one round-trip |
| `GET /api/state/stream` | SSE event stream |
| `GET /api/fleet` | `SubordinateWallet[]` + per-wallet derived runway |
| `GET /api/fleet/:id` | single wallet + recent samples |
| `GET /api/treasury` | `TreasurySource[]` + APY snapshots |
| `GET /api/actions?limit&before` | paginated ledger |
| `GET /api/actions/:id` | single action with full event timeline |
| `GET /api/policies` | policy registry + per-policy stats |
| `GET /api/policies/:name` | single policy config + evaluation history |
| `GET /api/settings` | runtime config (read-only) |

Type definitions for the response shapes live in `packages/shared-schemas/`. Import them, don't re-declare.

I'll provide static JSON fixtures in `apps/dashboard/lib/fixtures/` so you can develop against realistic data before the daemon is wired up. They'll match the production shapes exactly.

---

## Live updates

- Polling: `/api/state` every 5s on the Overview screen
- SSE: optional, listen to `/api/state/stream` for instant updates during a top-up cycle
- When daemon is offline: prominent banner with the literal CLI command to start it (`zerion qm run`)
- Use the 200ms opacity pulse (60% → 100%) on values that just changed — the only sanctioned animation in the app

---

## Component inventory

### From shadcn/ui (install via `npx shadcn-ui add <name>`)

button · card · table · tabs · dialog · badge · tooltip · separator · scroll-area · skeleton

Customize each one's tokens to point at our CSS variables. Don't ship the default shadcn theme.

### Custom (you write)

| Component | Where used |
|---|---|
| `StatsCard` | Three KPI cards on Overview |
| `RunwayChart` | Recharts horizontal stacked bar, one row per wallet |
| `LedgerTable` | Live-updating action list, with pulse on new rows |
| `PolicyCard` | Per-policy summary card |
| `WalletRow` | Fleet list row with runway pill |
| `DaemonStatusPill` | Green / amber / red lock icon + label |
| `TxLink` | Truncated 0x… with copy button + Basescan link |
| `EmptyState` | Reusable, with icon + heading + description + CTA-as-CLI-snippet |
| `Skeleton*` | Skeleton variants matching your real components |
| `ErrorState` | Reusable, with diagnosis + recovery instructions |

---

## Landing page brief

Single page, 7 sections, structure locked but visual treatment is yours:

1. **Hero**
   - Display heading (Fraunces): `Keep your agents solvent.`
   - Subhead (Inter): `Quartermaster is an autonomous treasury agent that funds your AI agent fleet — within cryptographic policy bounds, 24/7.`
   - Lead copy directly under subhead, in JetBrains Mono muted: `Live on Base. Five composable policies. Signs only what they permit.`
   - Two buttons: "View on GitHub" (primary, filled accent), "Read the docs" (secondary, outline)
   - Visual: an asciinema embed (~8 seconds, looped) showing `zerion fleet status` → daemon tick → top-up action → ledger update. **No stock illustration.** I'll provide the asciinema cast file.

2. **The problem** — 3 short paragraphs. The PRD has the substance; you write the prose. Sentences short. Paragraphs ≤3 sentences.

3. **Architecture** — single diagram. The PRD has an ASCII version (§5.1); you turn it into a real SVG. Specie palette only.

4. **Five policies** — card grid. Each card: name, one-line description, icon (Lucide), "view source" link to the GitHub file. Use the PRD §8 for the policy descriptions.

5. **Built on Zerion** — small logo strip, one-line credit, "Get a Zerion API key" CTA.

6. **Demo video** — embedded. ~2 minutes. I'll provide the file.

7. **Footer** — GitHub, hackathon link, my handle, contact.

### Writing rules (firm)

- No marketing puffery. The words "revolutionary," "first-ever," "game-changing" are banned.
- Sentences short. Paragraphs ≤ 3 sentences.
- Every claim falsifiable or links to a source.
- Technical terms defined inline first time.
- No emoji in chrome.

---

## The "Specie" feel

Think: a nineteenth-century counting house ledger book rendered in a terminal. Parchment, patina, antique gold, slate. Crypto-neon and cyberpunk are *opposite* of what we want — they signal "risk." We want **trust, weight, permanence.**

Reference points (mood, not literal):
- The ledger pages of an old bank
- Ferrante's MIT Press cover designs
- Linear.app's restraint, but warmer
- Stripe Atlas docs, but bolder accent

Things to avoid:
- Glowing borders, neon strokes
- Gradients on text or surfaces
- Glassmorphism / blur
- Gradient backgrounds
- 3D anything

---

## Development workflow

### Branches
- `main` — protected, only merges via PR
- Your branches: `frontend/<scope>` — e.g., `frontend/overview-screen`, `frontend/landing-hero`

### PR cadence
- Aim for one PR per route or component cluster — small, reviewable
- Don't let a PR sit longer than 2 days; ping me if I'm slow
- Each PR has: short description, screenshot/screencast of the change, any decisions you made that aren't in this brief

### Where to ask
- Anything design or product: ping me
- Anything backend / API / daemon: open a `question:` issue in the repo with the API endpoint and what you need

### What to ship per slice
1. **Day 1–2:** Monorepo set up, both apps booting, theme tokens wired, Inter + JetBrains Mono loading, shadcn installed, one shared layout component, dark/light toggle working.
2. **Day 3–5:** Landing page complete + deployed to Vercel preview.
3. **Day 6–9:** Dashboard Overview screen complete against fixtures. Loading + empty + error states.
4. **Day 10–12:** Remaining dashboard routes. Action detail with timeline. Policy detail.
5. **Day 13:** Polish, Lighthouse pass, cross-browser smoke (Chrome, Safari, Firefox).
6. **Day 14:** Bugs only. Code freeze.

Adjust as needed; this is a sketch, not a contract.

---

## Things that will trip you up (heads-up)

- **Tailwind v4 config is CSS-first.** `tailwind.config.ts` doesn't work the way it did in v3. Use `@theme { --color-... }` blocks in globals.css.
- **Next 16 default bundler is Turbopack.** Should mostly just work; if you see weird HMR, fall back via `next dev --webpack` once and report.
- **shadcn components ship with their own color tokens.** You'll need to override every `bg-background`, `text-foreground`, etc. to point at our variables. Worth doing once in `components/ui/*` and never touching again.
- **The dashboard CANNOT deploy to Vercel.** It polls `127.0.0.1:7402`. We don't deploy it. Vercel project is configured to build only `apps/landing`. Don't accidentally deploy the dashboard.
- **Asciinema embeds need a `<script>` tag.** Next.js with App Router, use `next/script` with `strategy="afterInteractive"`.
- **shadcn skeleton needs token override** — its default is `bg-muted` which is too dark on parchment.

---

## What "done" looks like

For the landing:
- Lighthouse Performance ≥ 95, Accessibility ≥ 95
- Loads under 1s on 3G simulated
- Looks correct in dark and light at 320px → 1920px widths
- Asciinema loops cleanly
- Demo video plays inline and is keyboard accessible

For the dashboard:
- All 9 routes implemented with empty + loading + error states
- Live polling works on `/overview` against the daemon
- Theme toggle persists across navigation
- Lighthouse ≥ 90 on `/overview`
- Loads ≤ 200KB initial JS
- All shadcn components themed to Specie tokens
- WebAIM checks pass for all token combinations actually used

If something on this list seems wrong or impossible, say so before doing it. I'd rather hear "this constraint conflicts with X" than discover it in review.

---

## Final note

This is a hackathon submission. The bar is "polished and shipped on time," not "every pixel perfect." If you have to choose between a beautiful unshipped feature and an OK shipped one, ship. We can polish post-submission.

If you have ideas that go beyond this brief — better visualizations, tighter flows, micro-interactions — I want to hear them. Don't ask permission for taste-level decisions; just show me. The locked stuff is locked because it's brand or contract; everything else is yours.

Thanks for taking this on. Excited to see what you ship.

— Tim

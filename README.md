# Quartermaster

> Treasury layer for the agent economy. Built on Zerion CLI.

x402 makes AI agents pay USDC per API call. They run dry. Quartermaster watches a fleet of agent wallets, projects when each will starve, and tops them up from the principal's yield positions — within five composable on-chain policies.

Submitted to the Colosseum Frontier Hackathon, Zerion CLI track.

## Status

Pre-Day-0 scaffold. Build phases 0→6 per `MASTER_PRD.md` §31.

## Apps

| App | Path | Deploy target | Port (dev) |
|---|---|---|---|
| Landing | `apps/landing/` | Vercel (public) | 3000 |
| Dashboard | `apps/dashboard/` | **LOCAL ONLY** — polls `http://127.0.0.1:7402` | 3001 |

The dashboard cannot deploy to Vercel — it polls localhost. Do not point Vercel at it.

## Develop

```bash
pnpm install
pnpm dev:landing      # localhost:3000
pnpm dev:dashboard    # localhost:3001

# Build everything
pnpm build

# Typecheck everything
pnpm typecheck
```

## Layout

```
quartermaster/
├── MASTER_PRD.md          # source of truth — read first
├── FRONTEND_BRIEF.md      # FE-specific scope, distilled from PRD
├── AGENT_PROGRESS.md      # session-to-session handoff log (PRD §28)
├── gap.md                 # gaps the FE dev finds against PRD/brief
├── docs-verified/         # frozen upstream doc snapshots + DEVIATIONS.md
├── apps/
│   ├── landing/           # public marketing site → Vercel
│   └── dashboard/         # local-only ops UI
├── packages/
│   └── shared-schemas/    # zod schemas — daemon ⇄ dashboard contract
├── cli/                   # forked zerion-ai (Phase 1)
└── scripts/               # demo-setup, verify-docs, seed-testnet
```

## Documents

| File | Audience | When to read |
|---|---|---|
| `MASTER_PRD.md` | everyone | source of truth for product spec |
| `FRONTEND_BRIEF.md` | frontend dev | start here; reach for PRD when needed |
| `HANDOFF.md` | repo owner | the init steps that got us here |
| `AGENT_PROGRESS.md` | next agent / next session | what was done, what's blocked, what's next |
| `gap.md` | frontend dev → repo owner | every gap or ambiguity hit during build |
| `docs-verified/DEVIATIONS.md` | everyone | every drift from PRD/upstream, with reason |

## Toolchain

- Node ≥22 (Day 0 verification target: 22.x LTS; `engines.node` set accordingly)
- pnpm `9.15.5` (activated via corepack from the `packageManager` field)
- Next 16.2.4, React 19.2.4, Tailwind v4, shadcn (base-nova style), Recharts 3, Lucide

See `docs-verified/DEVIATIONS.md` for any drift from PRD §21.2 pinned versions.

## License

MIT — see `LICENSE`.

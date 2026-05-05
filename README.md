# Quartermaster

> Treasury layer for the agent economy. Built on Zerion CLI.

x402 makes AI agents pay USDC per API call. They run dry. Quartermaster watches a fleet of agent wallets, projects when each will starve, and tops them up from the principal's yield positions — within five composable on-chain policies.

Submitted to the Colosseum Frontier Hackathon, Zerion CLI track.

## Status

Phase A complete (theme tokens + dashboard offline shell). Build phases 0→6 per `MASTER_PRD.md` §31.

## Surfaces & deploy targets

| Surface | Path | Deploy target | Notes |
| --- | --- | --- | --- |
| Landing | `apps/landing/` | **Vercel project A** — public marketing site | Static, no env vars |
| Dashboard | `apps/dashboard/` | **Vercel project B** — public demo UI | Reads `NEXT_PUBLIC_DAEMON_URL` (Railway URL for the demo) |
| Daemon | `cli/` (Phase 4) | **Railway** — public testnet demo daemon | Fresh Base Sepolia wallet; mainnet self-host only |

The Vercel-hosted dashboard polls the Railway-hosted demo daemon over HTTP. The demo daemon runs against Base Sepolia with a fresh testnet key — no mainnet wallets are ever exposed. Production users self-host (see [Self-host](#self-host) below).

This is a deliberate pivot from the original local-only architecture; rationale and protocol log in [`docs-verified/DEVIATIONS.md`](docs-verified/DEVIATIONS.md) under *Architectural Pivots*.

## Develop

```bash
pnpm install

pnpm dev:landing      # localhost:3000 (or 3002 if 3000 is occupied — see gap.md)
pnpm dev:dashboard    # localhost:3001

# Build everything
pnpm build

# Typecheck everything
pnpm typecheck
```

The dashboard reads `NEXT_PUBLIC_DAEMON_URL` and falls back to `http://127.0.0.1:7402` when unset, so local dev against your own daemon Just Works without a `.env.local`. See [`apps/dashboard/.env.example`](apps/dashboard/.env.example) for the public-demo configuration.

## Self-host

For production use against your own wallets, run the daemon on the same machine as the dashboard:

```bash
# 1. Clone, install, configure
git clone https://github.com/winsznx/quartermaster.git
cd quartermaster
pnpm install
cp .env.example .env             # fill in ZERION_API_KEY, WALLET_PRIVATE_KEY, etc.

# 2. Run the daemon (Phase 4 — not yet shipped)
zerion qm run                    # listens on http://127.0.0.1:7402

# 3. Run the dashboard against it
pnpm dev:dashboard               # localhost:3001 → polls 127.0.0.1:7402 by default
```

Self-hosters never set `NEXT_PUBLIC_DAEMON_URL` — the default points at localhost.

## Layout

```
quartermaster/
├── MASTER_PRD.md          # source of truth — read first
├── FRONTEND_BRIEF.md      # FE-specific scope, distilled from PRD
├── AGENT_PROGRESS.md      # session-to-session handoff log (PRD §28)
├── gap.md                 # gaps the FE dev finds against PRD/brief
├── docs-verified/         # frozen upstream doc snapshots + DEVIATIONS.md
├── apps/
│   ├── landing/           # public marketing site → Vercel project A
│   └── dashboard/         # public demo UI → Vercel project B
├── packages/
│   └── shared-schemas/    # zod schemas — daemon ⇄ dashboard contract
├── cli/                   # forked zerion-ai + qm daemon → Railway (Phase 1, 4)
└── scripts/               # demo-setup, verify-docs, seed-testnet
```

## Documents

| File                          | Audience                  | When to read                               |
| ----------------------------- | ------------------------- | ------------------------------------------ |
| `MASTER_PRD.md`               | everyone                  | source of truth for product spec           |
| `FRONTEND_BRIEF.md`           | frontend dev              | start here; reach for PRD when needed      |
| `HANDOFF.md`                  | repo owner                | the init steps that got us here            |
| `AGENT_PROGRESS.md`           | next agent / next session | what was done, what's blocked, what's next |
| `gap.md`                      | frontend dev → repo owner | every gap or ambiguity hit during build    |
| `docs-verified/DEVIATIONS.md` | everyone                  | architectural pivots and doc-verification drift |

## Toolchain

- Node ≥22 (Day 0 verification target: 22.x LTS; `engines.node` set accordingly)
- pnpm `9.15.5` (activated via corepack from the `packageManager` field)
- Next 16.2.4, React 19.2.4, Tailwind v4, shadcn (base-nova style), Recharts 3, Lucide

See `docs-verified/DEVIATIONS.md` for any drift from PRD §21.2 pinned versions.

## License

MIT — see `LICENSE`.

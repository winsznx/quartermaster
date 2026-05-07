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

## §26.4 Live demo — Base mainnet transactions

Quartermaster executed these transactions on **Base mainnet** during build. Click any hash to verify on Basescan. Every action below was driven by the daemon (or the bootstrap setup), not pre-recorded.

> Phase 7 extends this table with x402-paid subordinate calls (each one a real on-chain USDC transfer routed through the x402 facilitator) once the watcher is wired to read x402 receipts as the burn signal. Today's burn loop uses direct USDC transfers, which proves the watcher → decider → policy → executor path on the same primitives.

### J1 — burn-rate-oracle refusal (the policy moment)

Two consecutive top-up plans for `alpha-2` were **blocked by `burn-rate-oracle`** with the locked reason code. No on-chain tx — refusal happens pre-construction. The full `policyChecks[]` array is in `ledger.jsonl` and renders on `/actions/[id]` via the dashboard's `ShieldAlert` block.

| actionId | reasonCode | reasonText |
|---|---|---|
| `b489f1d6-a2ef-4f15-b978-eabfb629fd3b` | `BURN_RATE_ANOMALY_DETECTED` | recent hourly burn 0.0167 is **16.79× the 7d baseline 0.0010** (threshold 10×) |
| `949c5a71-f436-40f9-bc18-f4e8d3c36838` | `BURN_RATE_ANOMALY_DETECTED` | recent hourly burn 0.0117 is **11.76× the 7d baseline** (threshold 10×) |

### Happy-path top-ups — daemon → on-chain

Once alpha-2's burn rate decayed back inside the spike threshold, the next two ticks planned top-ups, all 5 layer-1 policies passed, and the executor sent USDC from `principal` to `alpha-2`:

| actionId | amount (USDC) | tx hash |
|---|---|---|
| `4d2feea5-62d3-415a-8ffd-edd69b3dcb66` | 0.683015 | [`0x8540cf09250f56626e4ac95a49d6a04a0eac3f2f135ce70cffdd7dd0bc34517a`](https://basescan.org/tx/0x8540cf09250f56626e4ac95a49d6a04a0eac3f2f135ce70cffdd7dd0bc34517a) |
| `8c8185dc-c13f-4630-96cb-2de46a2372bd` | 0.438111 | [`0x48ad6690a63b0a9275442b975a499b6b8f73c1a7e8f3f7f3acedef17d8a5bfe0`](https://basescan.org/tx/0x48ad6690a63b0a9275442b975a499b6b8f73c1a7e8f3f7f3acedef17d8a5bfe0) |

Each followed the full PRD §6.2 lifecycle: `topup_planned` → `topup_send_pending` → `topup_send_confirmed` → `topup_confirmed`.

### Subordinate burn loops (`qm test spike`)

Real ERC-20 transfers from each subordinate to the burn address `0x000000000000000000000000000000000000dEaD`, driving the watcher's EWMA so the policies have real signal:

#### alpha-1 spike (rate=5/h, 5 sends + 1 manual probe)

| # | tx |
|---|---|
| 1 | [`0x0537bfeb5b7f53e3a7104439740a40d35558918416226a676794f57562d13f2e`](https://basescan.org/tx/0x0537bfeb5b7f53e3a7104439740a40d35558918416226a676794f57562d13f2e) |
| 2 | [`0x4dae62a16dfd77f4bcaedcb8b615aecddf526be10a182f49e9356ec8345ad4e1`](https://basescan.org/tx/0x4dae62a16dfd77f4bcaedcb8b615aecddf526be10a182f49e9356ec8345ad4e1) |
| 3 | [`0xef8f38e8e9927eb5cc993ffd19365b28d374644d5f77b9d86a1919cf51d52e66`](https://basescan.org/tx/0xef8f38e8e9927eb5cc993ffd19365b28d374644d5f77b9d86a1919cf51d52e66) |
| 4 | [`0x0fdaa4971f26540a11fc21c3fddc685219607019da1d4ba4bb47af4c643e3571`](https://basescan.org/tx/0x0fdaa4971f26540a11fc21c3fddc685219607019da1d4ba4bb47af4c643e3571) |
| 5 | [`0x0c4e1c704f4557eb06f7c9ef43cb094771f827bbee5687cabb271ffdf1bab689`](https://basescan.org/tx/0x0c4e1c704f4557eb06f7c9ef43cb094771f827bbee5687cabb271ffdf1bab689) |
| 6 (probe) | [`0x3472b6c012cfd21881e51244a1e381f3b48bf4abb4c8e1a1e1b5c1ea96e5651a`](https://basescan.org/tx/0x3472b6c012cfd21881e51244a1e381f3b48bf4abb4c8e1a1e1b5c1ea96e5651a) |

#### alpha-2 spike (rate=10/h, 6 sends — drove the J1 + happy-path narrative above)

| # | tx |
|---|---|
| 1 | [`0x2a40bc2aff365f165f2ad71b921f31e788a9e1de591819c2152e03f4ae244a97`](https://basescan.org/tx/0x2a40bc2aff365f165f2ad71b921f31e788a9e1de591819c2152e03f4ae244a97) |
| 2 | [`0xaab08597bfadb2fabfa7957d720fdafb14e88a7d58793a092f101d8b0ec2e5ca`](https://basescan.org/tx/0xaab08597bfadb2fabfa7957d720fdafb14e88a7d58793a092f101d8b0ec2e5ca) |
| 3 | [`0x9d46d1fddcf6042876804832fc7c262eaba3ec766a52c096e7077cd133d86fa0`](https://basescan.org/tx/0x9d46d1fddcf6042876804832fc7c262eaba3ec766a52c096e7077cd133d86fa0) |
| 4 | [`0x77ab4f324e48039a9c82cb99bdb9134a7103e056763ad123727d0ae82bacda6d`](https://basescan.org/tx/0x77ab4f324e48039a9c82cb99bdb9134a7103e056763ad123727d0ae82bacda6d) |
| 5 | [`0x296b211af425d12d31d3d556f810b294b4c68b203af7ba3e09d7d98b55773b27`](https://basescan.org/tx/0x296b211af425d12d31d3d556f810b294b4c68b203af7ba3e09d7d98b55773b27) |
| 6 | [`0x13386428a9af764e0921132d2e0657f4e166e918e771e31b89fbe667762dc3ad`](https://basescan.org/tx/0x13386428a9af764e0921132d2e0657f4e166e918e771e31b89fbe667762dc3ad) |

### Setup transactions

Subordinate seed funding (`zerion send` from principal):

| recipient | tx |
|---|---|
| alpha-1 | [`0xcaa7b0eebf0dca495b5d3ae7c7684e8264b7e0468de030967fdaac6188c1d80d`](https://basescan.org/tx/0xcaa7b0eebf0dca495b5d3ae7c7684e8264b7e0468de030967fdaac6188c1d80d) |
| alpha-2 | [`0x6ef768a6fb93eba2f24225aed69dfe3782665b7a9e9420c44c205dad03964ef7`](https://basescan.org/tx/0x6ef768a6fb93eba2f24225aed69dfe3782665b7a9e9420c44c205dad03964ef7) |
| alpha-3 | [`0xd14bd48b300b12f9c506d69e018118f85874f798dafdfd8d76d36219204ff29f`](https://basescan.org/tx/0xd14bd48b300b12f9c506d69e018118f85874f798dafdfd8d76d36219204ff29f) |

ETH gas seeding (viem direct — sign-time `deny-transfers` policy correctly blocks raw native transfers via `zerion send`, so these one-shot setup transfers used `walletClient.sendTransaction`):

| recipient | tx |
|---|---|
| alpha-1 | [`0xf668307444c5934d8e2b1c4d386c3d86d65a1c6c2c362dd620543226147b9880`](https://basescan.org/tx/0xf668307444c5934d8e2b1c4d386c3d86d65a1c6c2c362dd620543226147b9880) |
| alpha-2 | [`0xa45ff870d86de8816d5704852cc2ffe1103944e5c3c86ba2694cb294b895e8fe`](https://basescan.org/tx/0xa45ff870d86de8816d5704852cc2ffe1103944e5c3c86ba2694cb294b895e8fe) |
| alpha-3 | [`0x58e4ff7a014ef558e8274f9b250dd5d6a4f1d8a168dab246970438497202beb2`](https://basescan.org/tx/0x58e4ff7a014ef558e8274f9b250dd5d6a4f1d8a168dab246970438497202beb2) |

### Reconcile demo (PRD §6.4)

A bug in the executor's `pickTxHash` (now fixed) produced three orphan top-up plans on a previous run. On the next daemon restart, `findOrphans()` returned 3 incomplete actions and the daemon **refused to tick** until the operator ran `zerion qm reconcile <id> --mark-failed` for each. After resolution, daemon resumed cleanly. After the successful happy-path top-ups, a kill+restart found zero orphans.

The full ledger (`ledger.jsonl`) contains the `topup_planned` → `daemon_halt` → `reconcile_resolved` event chain for those three actions, plus the clean `topup_planned` → `topup_send_pending` → `topup_send_confirmed` → `topup_confirmed` chain for the two real top-ups.

## License

MIT — see `LICENSE`.

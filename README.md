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

Quartermaster was tested on Base mainnet during build. The first run (Phase 4.6) revealed a stub destination in the simple-send code path; the second run (Phase 7a), post-fix, demonstrates the complete loop. **Both are documented here.** Click any hash to verify on Basescan.

### Phase 7a — canonical x402 demonstration (post-fix)

Driven end-to-end via [scripts/run-phase7a.mjs](scripts/run-phase7a.mjs) on Base mainnet. The full loop closes: subordinates pay the x402 facilitator for real Zerion API calls, the daemon's watcher reads the resulting balance drops, the policy stack rejects burn-rate anomalies and approves once the EWMA decays, and the executor sends from `principal` to the **correct subordinate address** (proves the [`sendOnlyPlan` fix](cli/lib/qm/daemon.js#L342-L364)).

#### Post-fix top-ups — destination verified on-chain

| target | actionId | amount | tx hash | recipient |
|---|---|---|---|---|
| alpha-1 | `9ac96d77-85ed-43ff-bf30-52ee70f24d1e` | 0.010194 USDC | [`0x3f86196721dbea55b50b971a97a28652af81d86864bf14f32a226d0ee4ac9422`](https://basescan.org/tx/0x3f86196721dbea55b50b971a97a28652af81d86864bf14f32a226d0ee4ac9422) | `0xc01a…243f` ✓ |
| alpha-2 | `bbb3cfc3-b4b3-4daf-948f-d87710610266` | 0.010072 USDC | [`0x0316d64bae20f3bc96599433d6ef0069514c449f6754605ad5e3ba7b74738b7c`](https://basescan.org/tx/0x0316d64bae20f3bc96599433d6ef0069514c449f6754605ad5e3ba7b74738b7c) | `0x551a…1c50` ✓ |

Each followed `topup_planned` → `topup_send_pending` → `topup_send_confirmed` → `topup_confirmed`. Both txs decode to `Transfer(USDC, principal=0x50b1…, recipient, amount)` where the recipient matches the fleet entry — not the `0xcccc…cccc` sink that Phase 4.6 hit.

#### Burn-rate-oracle blocks — four anomalies refused

| target | actionId | reasonText |
|---|---|---|
| alpha-1 | `63dc2fa3-3ccb-4fcc-8e14-3b853b15bf9c` | recent hourly burn 0.0364 is **12.44× the 7d baseline 0.0029** (threshold 10×) |
| alpha-2 | `c42e1a0d-1ba9-4bff-a478-cade6e11d288` | recent hourly burn 0.0391 is **22.13× the 7d baseline 0.0018** (threshold 10×) |
| alpha-2 | `8c8f6b8a-2f89-4b15-a9f3-0104ea30e7b9` | recent hourly burn 0.0274 is **15.49× the 7d baseline 0.0018** (threshold 10×) |
| alpha-2 | `0b732e77-331d-4363-af15-fae2dd8597f6` | recent hourly burn 0.0191 is **10.84× the 7d baseline 0.0018** (threshold 10×) |

All four are `topup_planned` + `topup_blocked` event pairs in `ledger.jsonl` with the full `policyChecks[]` array. The dashboard's `/actions/[id]` route renders these via `ShieldAlert`. The cascade on alpha-2 (22.13× → 15.49× → 10.84×) is the EWMA decay over three consecutive ticks; once the ratio dropped below 10× (tick 4), the same target's next plan passed and executed.

#### x402 settlements — agents paying for real API calls

Subordinates pay [the Zerion x402 facilitator](https://basescan.org/address/0xd07c06a650a88bbcf4f0c4fbf2c6c08c9a60acc6) per `analyze --x402` call. Each call settles as multiple USDC Transfer events at $0.01 each (provider + protocol split). 32 settlements captured this run; first and last shown per leg, full set in [scripts/phase7a-results.json](scripts/phase7a-results.json).

| leg | wallet | calls | settlements | first hash | last hash |
|---|---|---|---|---|---|
| alpha-1 burn (rate=2/min, 180s) | `0xc01a…243f` | 6 | 19 | [`0x8a11211f74…f13d`](https://basescan.org/tx/0x8a11211f74f07330da69032bb5a8d53020f0e57f65b2e517939e3222b516f13d) | [`0x9b7d9df896…c845c`](https://basescan.org/tx/0x9b7d9df896c35febabe157c2075373a6b6831b76534006aafd8bfd72153c845c) |
| alpha-2 spike (rate=30/min, 60s) | `0x551a…1c50` | 13 | 13 | [`0xc12e07fa8a…cbe2`](https://basescan.org/tx/0xc12e07fa8a602a75c6ee0cd0015f94d65f185fa671e98d923b525a3bfa5ecbe2) | [`0xd20287e6c0…6d4f`](https://basescan.org/tx/0xd20287e6c0835681e92fbfe6fede7e4940e042322444fe0df009b903d2696d4f) |

The `qm test x402-burn --wallet=<id>` command is the canonical narrative driver — each iteration spawns `analyze <target> --x402` with the subordinate's derived EVM key as `WALLET_PRIVATE_KEY`, settling on-chain. No mocks, no fixtures, no synthetic samples. The full one-shot e2e is reproducible via:

```bash
QM_KEYSTORE_PASSPHRASE='...' node scripts/run-phase7a.mjs
```

### Phase 4.6 — initial daemon validation (build process)

These transactions exercise the watcher → decider → policy → executor path end-to-end. They are real, on-chain, and signed by the daemon. **The three "happy-path top-ups" below carry a bug annotation — read carefully.**

#### J1 — burn-rate-oracle refusal (the policy moment)

Two consecutive top-up plans for `alpha-2` were **blocked by `burn-rate-oracle`** with the locked reason code. No on-chain tx — refusal happens pre-construction. The full `policyChecks[]` array is in `ledger.jsonl` and renders on `/actions/[id]` via the dashboard's `ShieldAlert` block.

| actionId | reasonCode | reasonText |
|---|---|---|
| `b489f1d6-a2ef-4f15-b978-eabfb629fd3b` | `BURN_RATE_ANOMALY_DETECTED` | recent hourly burn 0.0167 is **16.79× the 7d baseline 0.0010** (threshold 10×) |
| `949c5a71-f436-40f9-bc18-f4e8d3c36838` | `BURN_RATE_ANOMALY_DETECTED` | recent hourly burn 0.0117 is **11.76× the 7d baseline** (threshold 10×) |

#### Top-ups — daemon → on-chain (with bug annotation)

> ⚠ **Bug — sent to stub destination.** Phase 4.6 ran with a placeholder `sendTo` in `cli/lib/qm/daemon.js:sendOnlyPlan` (`"0x" + "c".repeat(40)`). The decider, policy stack, executor, and on-chain broadcast all worked correctly relative to the data they received — but the data was a placeholder. These three transactions sent $1.388 USDC of principal's budget to `0xcccccccccccccccccccccccccccccccccccccccc` instead of alpha-2. Discovered post-run during Phase 7a docs prep, fixed at `cli/lib/qm/daemon.js:342-364`, regression-guarded by `cli/tests/qm-no-stubs.test.mjs`. Re-demonstrated correctly in Phase 7a (above). See [DEVIATIONS §"Stub destination leak"](docs-verified/DEVIATIONS.md#2026-05-08--stub-destination-leak-in-sendonlyplan-discovered--fixed-during-phase-7a-docs-prep) for the full forensic.

| actionId | amount (USDC) | tx hash | destination |
|---|---|---|---|
| `4d2feea5-62d3-415a-8ffd-edd69b3dcb66` | 0.683015 | [`0x8540cf09250f56626e4ac95a49d6a04a0eac3f2f135ce70cffdd7dd0bc34517a`](https://basescan.org/tx/0x8540cf09250f56626e4ac95a49d6a04a0eac3f2f135ce70cffdd7dd0bc34517a) | `0xcccc…cccc` (sink) |
| `8c8185dc-c13f-4630-96cb-2de46a2372bd` | 0.438111 | [`0x48ad6690a63b0a9275442b975a499b6b8f73c1a7e8f3f7f3acedef17d8a5bfe0`](https://basescan.org/tx/0x48ad6690a63b0a9275442b975a499b6b8f73c1a7e8f3f7f3acedef17d8a5bfe0) | `0xcccc…cccc` (sink) |
| `46476a7d-96e5-4ee6-9c0b-4c7957304383` | 0.266678 | [`0x81e750db1e60ca66e49b94cb86d6ea1301748c51fa77cdacad285cad48cbb70e`](https://basescan.org/tx/0x81e750db1e60ca66e49b94cb86d6ea1301748c51fa77cdacad285cad48cbb70e) | `0xcccc…cccc` (sink) |

Each followed the full PRD §6.2 lifecycle: `topup_planned` → `topup_send_pending` → `topup_send_confirmed` → `topup_confirmed`. The lifecycle and policy logic are valid; only the send destination was wrong.

#### Subordinate burn loops (`qm test spike`)

Real ERC-20 transfers from each subordinate to the burn address `0x000000000000000000000000000000000000dEaD`, driving the watcher's EWMA so the policies have real signal:

##### alpha-1 spike (rate=5/h, 5 sends + 1 manual probe)

| # | tx |
|---|---|
| 1 | [`0x0537bfeb5b7f53e3a7104439740a40d35558918416226a676794f57562d13f2e`](https://basescan.org/tx/0x0537bfeb5b7f53e3a7104439740a40d35558918416226a676794f57562d13f2e) |
| 2 | [`0x4dae62a16dfd77f4bcaedcb8b615aecddf526be10a182f49e9356ec8345ad4e1`](https://basescan.org/tx/0x4dae62a16dfd77f4bcaedcb8b615aecddf526be10a182f49e9356ec8345ad4e1) |
| 3 | [`0xef8f38e8e9927eb5cc993ffd19365b28d374644d5f77b9d86a1919cf51d52e66`](https://basescan.org/tx/0xef8f38e8e9927eb5cc993ffd19365b28d374644d5f77b9d86a1919cf51d52e66) |
| 4 | [`0x0fdaa4971f26540a11fc21c3fddc685219607019da1d4ba4bb47af4c643e3571`](https://basescan.org/tx/0x0fdaa4971f26540a11fc21c3fddc685219607019da1d4ba4bb47af4c643e3571) |
| 5 | [`0x0c4e1c704f4557eb06f7c9ef43cb094771f827bbee5687cabb271ffdf1bab689`](https://basescan.org/tx/0x0c4e1c704f4557eb06f7c9ef43cb094771f827bbee5687cabb271ffdf1bab689) |
| 6 (probe) | [`0x3472b6c012cfd21881e51244a1e381f3b48bf4abb4c8e1a1e1b5c1ea96e5651a`](https://basescan.org/tx/0x3472b6c012cfd21881e51244a1e381f3b48bf4abb4c8e1a1e1b5c1ea96e5651a) |

##### alpha-2 spike (rate=10/h, 6 sends — drove the J1 + happy-path narrative above)

| # | tx |
|---|---|
| 1 | [`0x2a40bc2aff365f165f2ad71b921f31e788a9e1de591819c2152e03f4ae244a97`](https://basescan.org/tx/0x2a40bc2aff365f165f2ad71b921f31e788a9e1de591819c2152e03f4ae244a97) |
| 2 | [`0xaab08597bfadb2fabfa7957d720fdafb14e88a7d58793a092f101d8b0ec2e5ca`](https://basescan.org/tx/0xaab08597bfadb2fabfa7957d720fdafb14e88a7d58793a092f101d8b0ec2e5ca) |
| 3 | [`0x9d46d1fddcf6042876804832fc7c262eaba3ec766a52c096e7077cd133d86fa0`](https://basescan.org/tx/0x9d46d1fddcf6042876804832fc7c262eaba3ec766a52c096e7077cd133d86fa0) |
| 4 | [`0x77ab4f324e48039a9c82cb99bdb9134a7103e056763ad123727d0ae82bacda6d`](https://basescan.org/tx/0x77ab4f324e48039a9c82cb99bdb9134a7103e056763ad123727d0ae82bacda6d) |
| 5 | [`0x296b211af425d12d31d3d556f810b294b4c68b203af7ba3e09d7d98b55773b27`](https://basescan.org/tx/0x296b211af425d12d31d3d556f810b294b4c68b203af7ba3e09d7d98b55773b27) |
| 6 | [`0x13386428a9af764e0921132d2e0657f4e166e918e771e31b89fbe667762dc3ad`](https://basescan.org/tx/0x13386428a9af764e0921132d2e0657f4e166e918e771e31b89fbe667762dc3ad) |

#### Setup transactions

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

#### Reconcile demo (PRD §6.4)

A bug in the executor's `pickTxHash` (now fixed) produced three orphan top-up plans on a previous run. On the next daemon restart, `findOrphans()` returned 3 incomplete actions and the daemon **refused to tick** until the operator ran `zerion qm reconcile <id> --mark-failed` for each. After resolution, daemon resumed cleanly. After the successful happy-path top-ups, a kill+restart found zero orphans.

The full ledger (`ledger.jsonl`) contains the `topup_planned` → `daemon_halt` → `reconcile_resolved` event chain for those three actions, plus the clean `topup_planned` → `topup_send_pending` → `topup_send_confirmed` → `topup_confirmed` chain for the two real top-ups.

## License

MIT — see `LICENSE`.

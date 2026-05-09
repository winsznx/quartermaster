# Quartermaster

> **Treasury layer for the agent economy.** Watches a fleet of x402-paying AI agents, projects runway, tops them up from the principal's yield positions — within five composable on-chain policies.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/winsznx/quartermaster)](https://github.com/winsznx/quartermaster/commits/main)
[![Landing](https://img.shields.io/badge/Landing-quartermaster--landing.vercel.app-black)](https://quartermaster-landing.vercel.app)
[![Dashboard](https://img.shields.io/badge/Dashboard-quartermaster--dashboard.vercel.app-black)](https://quartermaster-dashboard.vercel.app)

Submitted to the Colosseum Frontier Hackathon, Zerion CLI track.

---

## What is Quartermaster?

**x402 made agents pay-as-they-go on-chain.** Coinbase shipped the protocol; Zerion shipped a CLI that lets agents settle each API call in USDC on Base. The agent's wallet is the budget; when it empties, the agent stops mid-task with no warning. That's a real operational problem the moment you run more than one.

**Quartermaster is the treasury that keeps them solvent.** A daemon watches each subordinate wallet's USDC balance via Zerion's API, derives an EWMA burn rate, projects when each will run dry, picks the lowest-yield drainable source from your treasury (idle USDC before staked ETH), and signs the top-up via an agent token whose authority is narrow by construction. No keys leave the operator's machine; no human in the loop after configuration.

**The framework, not the daemon, is the contribution.** Five composable on-chain policies — `allowlist`, `max-per-action-cap`, `cooldown-window`, `burn-rate-oracle`, `yield-curve-preservation` — gate every action at decider-time, before any tx is constructed. Adding a sixth is a single file plus a one-line registration. The two-layer model (decider-time policy + sign-time policy) gives you both *don't plan it* and *don't sign it* — defense in depth, not just defense.

## Live demonstration

- **Real Base mainnet transactions** — top-ups, burn-rate-oracle blocks, x402 settlements. See [§26.4 Live demo](#264-live-demo--base-mainnet-transactions) below for the full hash table (Phase 7a post-fix run + Phase 4.6 annotated). Every hash links to Basescan.
- **Demo video** — lands at `apps/landing/public/demo.mp4` (gracefully placeholdered until then; the landing page swaps in the `<video>` element automatically when the file is committed).
- **Asciinema cast of the daemon driving the e2e** — lands at `apps/landing/public/hero.cast`. Same graceful-fallback pattern; the static terminal block on the landing page stays in place until the cast file is committed, then the asciinema-player CDN bundle takes over.

The `scripts/run-phase7a.mjs` driver reproduces the entire e2e in one command. Output writes to `scripts/phase7a-results.json` for verification.

## Architecture

The principal owns the seed phrase, the treasury wallet, and sets the policies. The Quartermaster daemon holds a narrow agent token with sign-only authority — it cannot export keys, change policies, or send to non-allowlisted addresses. Subordinate agents hold small float wallets and pay x402 settlements per API call. Trust flows downward only: a compromised subordinate cannot pull from the daemon; a compromised daemon cannot exceed policy-capped outflow.

```
┌────────────────────────────────────────────────────────────┐
│                    PRINCIPAL (human)                       │
│         owns: Treasury Wallet, sets Policies               │
└──────────────────────┬─────────────────────────────────────┘
                       │ creates agent token + policies
                       ↓
┌────────────────────────────────────────────────────────────┐
│                  QUARTERMASTER DAEMON                      │
│ ┌────────────┐  ┌────────────┐  ┌─────────────────────┐    │
│ │ Watcher    │→ │ Decider    │→ │ Executor            │    │
│ │ (cron)     │  │ (5-policy  │  │ (zerion CLI wrap)   │    │
│ │            │  │  framework)│  │                     │    │
│ └────────────┘  └────────────┘  └─────────────────────┘    │
│      ↑                                   │                 │
│      │ reads balances,                   │ signs via OWS   │
│      │ burn rates, yields                │ with agent token│
│      │ (Zerion API)                      │                 │
└──────┼───────────────────────────────────┼─────────────────┘
       │                                   │
       │                                   ↓
┌──────┼──────────────────┐   ┌────────────────────────────┐
│ Zerion API              │   │ Forked Zerion CLI          │
│ (portfolio, positions,  │   │ ┌─────────┐  ┌───────────┐ │
│  pnl, transactions,     │   │ │commands │  │ policies  │ │
│  fungibles)             │   │ │swap     │  │ (sign-time│ │
└─────────────────────────┘   │ │bridge   │  │  layer 2) │ │
                              │ │send     │  │           │ │
                              │ │qm       │  │           │ │
                              │ └─────────┘  └───────────┘ │
                              └────────────────────────────┘
                                          │
                                          ↓ on-chain
                              ┌────────────────────────────┐
                              │  Base mainnet (settlement) │
                              └────────────────────────────┘
                                          │
                                          ↓ USDC lands in
                              ┌────────────────────────────┐
                              │  Subordinate Agent Wallets │
                              │  (each paying per-call     │
                              │   Zerion API via x402)     │
                              └────────────────────────────┘
```

The watcher reads balances from Zerion's portfolio API, the decider runs every planned action through the layer-1 policy framework, and the executor calls the forked Zerion CLI as a subprocess to sign and broadcast. Each tx the executor produces also passes through the upstream sign-time policies (layer 2 — `allowlist`, `deny-transfers`, etc., enforced at the wallet boundary). See [`docs-verified/DEVIATIONS.md`](docs-verified/DEVIATIONS.md) for the layer split rationale.

## Policy framework

The five layer-1 policies live in [`cli/policies/`](cli/policies). Every planned top-up runs through all five at decider-time, in order; rejection by any policy emits `topup_blocked` with a structured `reasonCode` + `reasonText` that the dashboard renders verbatim.

| Policy | Reject when | Reason code |
|---|---|---|
| [`allowlist`](cli/policies/allowlist.mjs) | target wallet not registered in fleet | `NOT_IN_FLEET` |
| [`max-per-action-cap`](cli/policies/max-per-action-cap.mjs) | planned amount exceeds `MAX_USDC_PER_ACTION` (default $100) | `EXCEEDS_MAX_PER_ACTION` |
| [`cooldown-window`](cli/policies/cooldown-window.mjs) | last confirmed top-up to same target within `COOLDOWN_MIN` (default 30m) | `COOLDOWN_NOT_ELAPSED` |
| [`burn-rate-oracle`](cli/policies/burn-rate-oracle.mjs) | recent EWMA burn ≥ 10× the 7d baseline (or sustained-need check fails) | `BURN_RATE_ANOMALY_DETECTED` / `NO_SUSTAINED_BURN` / `RUNWAY_NOT_BELOW_THRESHOLD` |
| [`yield-curve-preservation`](cli/policies/yield-curve-preservation.mjs) | selected source is not the lowest-APY eligible position (would liquidate stETH while idle USDC covers) | `YIELD_CURVE_VIOLATION` |

Reason codes are pinned in [`packages/shared-schemas/src/reason-codes.ts`](packages/shared-schemas/src/reason-codes.ts) — schema-validated end-to-end so the dashboard can render the exact same string the policy emitted.

### Two-layer model

```
┌──────────────────────────────────┐
│  Layer 1 — decider-time (ours)   │   evaluate(ctx) → { ok, reasonCode? }
│  cli/policies/*.mjs              │   pure, async, runs BEFORE tx is built
│  domain types (PolicyContext)    │
└──────────────┬───────────────────┘
               │  if ok: build + send tx
               ↓
┌──────────────────────────────────┐
│  Layer 2 — sign-time (upstream)  │   check(ctx) → { allow, reason? }
│  cli/cli/policies/*.mjs          │   pure, sync, runs AT signing
│  tx-shaped types (RawTxContext)  │
└──────────────────────────────────┘
```

Layer 1 prevents bad plans from being constructed. Layer 2 prevents a malicious or buggy plan from being signed even if layer 1 was bypassed. Both must pass; they share no contracts. This is enforced by the test suite ([`cli/tests/qm-policies.test.mjs`](cli/tests/qm-policies.test.mjs) — see "two-layer architecture regression guard").

### Why this is the moat

A daemon that watches balances and tops them up is a weekend project. The defensible thing is the policy framework: locked reason codes, a two-layer model, an evaluator contract that's pure-functional and async, and a registration step that's one line. Five policies ship in v1 because that's what the canonical demo needs. The next ten — domain-specific things like *time-of-day caps*, *per-counterparty drift detectors*, *stablecoin-only sources* — are small. The framework is the contribution; the policies in v1 are the existence proof.

## Quick start

### 1. Browse the live deployment (no clone needed)

| Surface | URL |
|---|---|
| Landing | [quartermaster-landing.vercel.app](https://quartermaster-landing.vercel.app) |
| Dashboard | [quartermaster-dashboard.vercel.app](https://quartermaster-dashboard.vercel.app) — polls a public Railway daemon |
| Daemon API (raw) | `<railway-domain>/api/health` — see Railway env or run `curl <dashboard-url>/api/state-proxy` |

The dashboard's status pill carries a **Deployed** badge when it's hitting the Railway daemon. The daemon runs the same code as a local install; all `/api/*` reads are public, all writes are gated to keys the operator holds. A small live-orchestrator subroutine fires a real x402 burn every ~15 minutes (hard-capped at $5 USDC/month) so the dashboard always has fresh activity. Service interruption (typically a Railway cold-start, ~15s) shows the matching offline copy variant.

### 2. Run your own (self-host)

For production use against your own wallets — full key custody on your machine, no third-party signing path:

**Prerequisites:**
- Node ≥ 22 (LTS recommended)
- pnpm 9.15.5+ (activated via corepack: `corepack enable`)
- A Zerion API key — [developers.zerion.io](https://developers.zerion.io)
- A funded Base mainnet wallet (≥ $5 USDC + ~$0.01 ETH for gas) for the principal — **never your main wallet**

**Steps:**

```bash
# 1. Clone + install
git clone https://github.com/winsznx/quartermaster.git
cd quartermaster
pnpm install

# 2. Configure secrets — copy the example, then fill in ZERION_API_KEY +
#    WALLET_PRIVATE_KEY (a fresh key for the principal). Never commit .env.local.
cp .env.example .env.local
$EDITOR .env.local

# 3. Bootstrap the keystore + agent tokens + fleet. Walks you through:
#    - import principal, create alpha-1/2/3 subordinates
#    - mint scoped agent tokens for each
#    - register the fleet in ~/.zerion/quartermaster/fleet.json
#    - register the principal as a treasury source
#    Full step-by-step (with screenshots) in:
open cli/BOOTSTRAP.md

# 4. Run the daemon (binds 127.0.0.1:7402, broadcasts SSE state)
node cli/cli/zerion.js qm run

# 5. In a second terminal, open the dashboard against your daemon
pnpm dev:dashboard
# → http://localhost:3001 (polls 127.0.0.1:7402 by default)
```

Self-hosters never set `NEXT_PUBLIC_DAEMON_URL` — the default points at localhost. The daemon stays bound to `127.0.0.1` (no network exposure) unless `QM_PUBLIC=1` is set.

To reproduce the README §26.4 evidence end-to-end on your own funded wallets, see [`cli/BOOTSTRAP.md` § "Phase 7a re-run"](cli/BOOTSTRAP.md#phase-7a-re-run--one-shot-driver) — `QM_KEYSTORE_PASSPHRASE='...' node scripts/run-phase7a.mjs` runs the full canonical narrative in ~9 minutes.

### 3. Deploy your own public instance

To put your own daemon on Railway behind a public URL (so your dashboard can be browsed by anyone), see [`cli/RAILWAY_DEPLOY.md`](cli/RAILWAY_DEPLOY.md). End-to-end takes ~30 minutes if you've already completed the local bootstrap. Daemon's signing code is unchanged; the deploy just exposes the read-only HTTP surface to the network.

## Architecture decisions

These choices are locked. Each has a rationale entry; deep readers should follow the link.

| Decision | Rationale |
|---|---|
| Files over a database (`ledger.jsonl`, `fleet.json`) | Reviewable via `cat`, atomic appends, no deploy story. [PRD §5.3](MASTER_PRD.md) |
| Subprocess to forked Zerion CLI (not module import) | Clean trust boundary, easy upstream upgrade, CLI-as-stable-interface. [PRD §5.3](MASTER_PRD.md) |
| Two-layer policy split | Layer 1 (decider-time) for planning; layer 2 (sign-time) at the wallet. Defense in depth. [PRD §8.0](MASTER_PRD.md) |
| Locked reason codes (zod-pinned) | Dashboard renders exactly what the policy emits — no string drift. [shared-schemas](packages/shared-schemas/src/reason-codes.ts) |
| Hono on `127.0.0.1:7402` (not `0.0.0.0`) | Daemon never exposes itself to the network. [PRD §22.3](MASTER_PRD.md) |
| EWMA over rolling-mean for burn rate | α=0.30 (~2h half-life) catches sustained-shift faster, ignores one-shot blips. [`cli/lib/qm/ewma.js`](cli/lib/qm/ewma.js) |
| Base mainnet for the demo, not Sepolia | Zerion API does not index Base Sepolia. [DEVIATIONS](docs-verified/DEVIATIONS.md) |

## Contributing — write your own policy

A policy is a single file. Drop it at [`cli/policies/your-policy.mjs`](cli/policies):

```js
// cli/policies/your-policy.mjs
import {
  passResult,
  PolicyContext,
  REASON_CODES,
  rejectResult,
} from "@quartermaster/shared-schemas";

export const policyName = "your-policy";
export const policyVersion = "1.0.0";

export async function evaluate(context) {
  const parsed = PolicyContext.safeParse(context);
  if (!parsed.success) {
    return rejectResult(
      REASON_CODES.MALFORMED_CONTEXT,
      `your-policy: malformed PolicyContext (${parsed.error.issues.length} issue(s))`,
    );
  }
  const ctx = parsed.data;

  // Your logic. Return rejectResult(reasonCode, reasonText) on fail,
  // passResult() on pass. Both layered onto PolicyResult.
  if (/* your reject condition */) {
    return rejectResult(
      REASON_CODES.YOUR_NEW_REASON_CODE,
      `your-policy: rejected because <specific reason> (with numbers)`,
    );
  }

  return passResult();
}
```

Then register it in [`cli/lib/qm/run-policies.js`](cli/lib/qm/run-policies.js):

```diff
 import * as allowlist from "../../policies/allowlist.mjs";
 import * as maxPerActionCap from "../../policies/max-per-action-cap.mjs";
 import * as cooldownWindow from "../../policies/cooldown-window.mjs";
 import * as burnRateOracle from "../../policies/burn-rate-oracle.mjs";
 import * as yieldCurvePreservation from "../../policies/yield-curve-preservation.mjs";
+import * as yourPolicy from "../../policies/your-policy.mjs";

 const REGISTRY = [
   { module: allowlist },
   { module: maxPerActionCap },
   { module: cooldownWindow },
   { module: burnRateOracle },
   { module: yieldCurvePreservation },
+  { module: yourPolicy },
 ];
```

Add a new reason code in [`packages/shared-schemas/src/reason-codes.ts`](packages/shared-schemas/src/reason-codes.ts) (the zod enum is the single source of truth — dashboard reads it via the same package).

Add a test at `cli/tests/qm-policies.test.mjs` covering the 5 mandatory cases per PRD §25.2: known-good context, boundary at threshold, just-over threshold, extreme anomalous, malformed context. Existing tests in that file are the template.

Run `pnpm --filter ./cli test` — the new policy joins the dispatcher automatically and the existing two-layer regression guard verifies it doesn't break the layer-1 contract.

## Layout

```
quartermaster/
├── README.md             # this file
├── MASTER_PRD.md         # source of truth — design + scope
├── AGENT_PROGRESS.md     # session-to-session handoff log (PRD §28)
├── docs-verified/        # frozen upstream doc snapshots + DEVIATIONS.md
├── apps/
│   ├── landing/          # public marketing site → Vercel project A
│   └── dashboard/        # public demo UI → Vercel project B
├── packages/
│   └── shared-schemas/   # zod schemas — daemon ⇄ dashboard contract
├── cli/                  # forked Zerion CLI + qm daemon
│   ├── policies/         # layer-1 policy modules (the framework)
│   ├── commands/qm/      # qm subcommands (run, plan, test, reconcile, …)
│   ├── lib/qm/           # daemon internals: watcher, decider, executor, …
│   ├── tests/            # node --test runner; qm-* + upstream tests
│   ├── BOOTSTRAP.md      # operator setup walkthrough
│   └── ...
└── scripts/
    └── run-phase7a.mjs   # one-shot e2e driver for §26.4 reproduction
```

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


## License & acknowledgments

MIT — see [`LICENSE`](LICENSE).

Built on:
- **[Zerion CLI](https://github.com/zeriontech/zerion-ai)** — the execution layer. Every swap, bridge, and send is a `node cli/cli/zerion.js <cmd>` subprocess (npx-resolved against the local fork, not the published package — see Phase 4.6 `pickTxHash` notes in [DEVIATIONS](docs-verified/DEVIATIONS.md)). Forked at PR #5 (`c39fb6d`). Sanctioned upstream-touches are fenced QM blocks documented in DEVIATIONS.
- **[x402](https://x402.org)** — Coinbase's pay-per-call HTTP standard. The protocol that made this product necessary.
- **[viem](https://viem.sh)** — for the on-chain reads (gas seeding, balance probes) that bypass the agent token's `deny-transfers` policy by design.
- **[Hono](https://hono.dev)**, **[zod](https://zod.dev)**, **[Next.js](https://nextjs.org)**, **[Tailwind v4](https://tailwindcss.com)**, **[Recharts](https://recharts.org)**, **[Lucide](https://lucide.dev)**, **[asciinema-player](https://github.com/asciinema/asciinema-player)** (CDN, vanilla JS — no React wrapper).

Submitted to the [Colosseum Frontier Hackathon](https://www.colosseum.com/frontier), Zerion CLI track.

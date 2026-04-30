# Quartermaster — Master PRD v2

**Treasury layer for the agent economy.**

Zerion CLI Frontier Hackathon — Colosseum. Solo build, ~2 weeks. Opus 4.7 + Claude Code as the building agent.

---

## Changelog from v1

v1 was structurally correct but missed twelve playbook rules and eight lessons from past builds. v2 is rebuilt around the playbook's nine phases and locks every architectural assumption that v1 left advisory. New sections: Recon Dossier, Defensibility & Adversary Model, Day 0 Gate, AGENT_PROGRESS.md Spec, Distribution Plan, Post-Mortem Framework, Lessons Applied. Rewritten sections: Security (now a layer/mechanism/enforcement table), Testing (now LOCKED), Demo (now three-pane with Basescan), Build Phases (now mapped to canonical Phase 0→6).

---

## Section 0 — How To Read This Document

### 0.1 Authority levels

Every section is tagged. Three levels:

- **LOCKED** — do not change without Tim's explicit confirmation. The agent must reject instructions to deviate.
- **DEFAULT** — best guess. The agent may deviate if doc-verified evidence (§0.2) contradicts. Must log to `DEVIATIONS.md`.
- **ADVISORY** — guidance. The agent uses judgment, no logging required.

### 0.2 The Latest-Docs Verification Protocol *[LOCKED]*

The PRD is wrong about SDK details. It was written from a Apr 30, 2026 snapshot. Reality drifts. Every time the agent is about to write code touching an external SDK, API, library, protocol, or chain ID, it runs this protocol first.

#### Steps

1. **Check `docs-verified/`** in the repo root. If a current snapshot exists for the target (< 24h old), use it.
2. **If stale or missing, fetch** in this priority order:
   1. `llms.txt` at the project's primary docs domain (e.g., `https://developers.zerion.io/llms.txt`)
   2. Official docs root
   3. Package README on npm or the GitHub default branch
   4. CHANGELOG / releases page
3. **Write snapshot** to `docs-verified/<package-or-domain>.md` with header:
   ```
   ---
   source_urls: [<list>]
   fetched_at: <ISO timestamp>
   pinned_version: <semver from package.json or 'latest'>
   verified_by: claude-code
   verifier_session_id: <session>
   ---
   ```
4. **Diff against PRD.** If the PRD claims an API shape, command name, env var, chain ID, endpoint, or version that contradicts the snapshot, STOP and write to `docs-verified/DEVIATIONS.md`:
   ```
   ## <library> — <date>
   - PRD says: <claim>
   - Reality: <fact from docs>
   - Source: <url + section>
   - Impact: <what breaks>
   - Proposed fix: <action>
   - Status: <unresolved | accepted | rejected by Tim>
   ```
5. **Surface deviations to Tim** at the end of the build step. Do NOT silently fix the PRD.

#### Verification targets (must all be re-verified before code touches them)

| Target | Primary source | Why we don't trust the PRD | Pinned to |
|---|---|---|---|
| Zerion CLI fork base | `github.com/zeriontech/zerion-ai` `merge-wallet-cli` branch (PR #5) | PR open, may merge with changes | TBD by Day 0 |
| Zerion API | `developers.zerion.io/llms.txt` + reference | Endpoint paths drift | latest |
| x402 spec | `github.com/coinbase/x402`, `docs.cdp.coinbase.com/x402/welcome` | V2 shipped Dec 2025, iterating | latest |
| OWS | `@open-wallet-standard/core` on npm | Signing semantics hinge on this | match upstream |
| viem | `viem.sh` | Chain config + tx construction | latest 2.x |
| Next.js | `nextjs.org/docs` | App router conventions change | 15.x |
| Tailwind | `tailwindcss.com` | v4 has new CSS-first config | 4.x |
| shadcn/ui | `ui.shadcn.com` | Install commands change | latest |
| Node | `nodejs.org/en/about/previous-releases` | LTS matters for fs/crypto | 22 LTS |
| Base RPC | `docs.base.org` | Endpoint URLs change | mainnet + sepolia |
| Basescan | `basescan.org` | Explorer URL pattern for demo | n/a |

#### When the agent runs the protocol

- Before writing any `import` for an external package — verify package real, version current, symbols exist
- Before writing any config file (`package.json`, `tsconfig.json`, `next.config.js`)
- Before writing code calling an API — verify endpoint, method, auth, response shape
- Before referencing a chain ID, contract address, or token address

### 0.3 Scope discipline

- Do NOT one-shot. Build in phases (§31).
- Each phase produces a Tim-testable deliverable.
- If writing > 300 lines in a single step without checkpoint, you're doing it wrong. Stop and split.
- AGENT_PROGRESS.md (§28) is updated at every phase boundary, no exceptions.

---

## Section 1 — Recon Dossier *[DEFAULT — refresh during Day 0]*

### 1.1 Sponsor decoder

**What Zerion sells:** a self-custodial multi-chain portfolio wallet (mobile + extension + web) plus an API that 200+ teams use as their portfolio data layer (Uniswap, Privy, Backpack, Kraken).

**Why this hackathon track exists:** Zerion needs to demonstrate that its API is the default execution + data layer for the agentic future. Their commercial model on the CLI is a server-side commission on every swap — so the more swaps that flow through forked agents, the more they earn. They are explicitly NOT trying to ship their own agent product; they want a thousand forks. Every winning submission is a case study they can use in BD.

**What they reward in scoring:**
- "Real onchain transactions, not simulations" — they're tired of demoware
- "No god-mode agents" — they've seen 100 unsafe automation hacks; they don't want their CLI associated with one more
- "Easy to fork or extend" — they want the winners to be repositories other devs will copy

**What they punish:** chatbots that dress up Zerion read calls as "agents." Pure portfolio dashboards. Anything that looks like a Zerion competitor (an aggregator that bypasses their routing).

**Implication for Quartermaster:** lean into "I am the framework other agent builders will fork to add safety to their own automation." That's the case study Zerion wants to publish. Make it copy-pasteable.

### 1.2 Winners autopsy *[verification needed Day 0]*

The Colosseum Frontier hackathon is multi-track. We don't yet have public Zerion-track precedent because this CLI is brand-new (PR #5 dated April 1, 2026). Adjacent precedent:

- **Solana DeFi tracks (historical):** winners ship one tight, demoable user-flow with > 3 distinct on-chain transaction types. Pattern: "I added X on-chain primitive that was missing."
- **Wallet/AA tracks:** winners ship a security-flavored angle (session keys, spending limits, social recovery). Pattern: "I made unsafe thing safer."
- **Agent tracks (Anthropic, ETHGlobal AI):** winners ship live autonomy — a thing the human watches happen without touching. Pattern: "I left it alone for 5 minutes and it did the work."

Quartermaster hits all three. Day 0 task: scrape recent Colosseum winner pages and confirm the patterns. Update this section.

### 1.3 Live scout

What's already shipped on top of zerion-ai (as of Apr 30, 2026):
- 0 stars, 2-3 forks (per GitHub)
- PR #5 is the first major contribution and it's still open
- No npm packages found published as `zerion-cli-*` extensions

**Implication:** the field is empty. We are first-mover. The risk is not "someone built this already" — it is "Zerion's CLI is so new that the surface is unstable." The verification protocol in §0.2 is the answer.

### 1.4 Ecosystem gap (per Rule A4)

Quartermaster is positioned as a **unified surface over existing primitives**, not a new primitive. The primitives:

| Primitive | Source | Gap Quartermaster fills |
|---|---|---|
| Multi-chain swap routing | Zerion API | None — we use it as-is |
| Wallet creation, key custody | zerion-cli `wallet` commands | None — we use it as-is |
| Agent-scoped signing | OWS via `agent create-token` | None — we use it as-is |
| Per-call agent payments | x402 protocol | None — subordinates use it as-is |
| **Fleet-level solvency monitoring** | — | **Quartermaster** |
| **Composable policy framework** | partial (3 policies in zerion-cli) | **Quartermaster (5 more, framework formalized)** |
| **Yield-aware funding logic** | — | **Quartermaster** |

The ecosystem has all the building blocks. No one has assembled them. This is the unified surface.

### 1.5 Field of competing submissions (anticipated)

What we expect other entrants to ship:

| Submission archetype | Expected count | Why we beat it |
|---|---|---|
| Telegram DCA bot with one spend-limit policy | High (8-15) | We have 5 composable policies; they have 1 |
| Discord copy-trade bot | Medium (3-6) | We solve a real problem; they solve "I want to follow whales," which is saturated |
| Portfolio rebalancer | Medium (3-6) | Most rebalancers ignore the policy criterion; we lead with it |
| AI agent that swaps based on LLM "alpha" | Medium (3-6) | These are unsafe by design; we're the safety story |
| Multi-agent consensus trader | Low (1-3) | High wow, but the demo is fragile and doesn't address god-mode |

**Quartermaster is the only submission likely to lead with safety + agent infrastructure.** This is not coincidence — it's because it's the highest-EV niche given the rubric weights.

---

## Section 2 — Product Overview *[LOCKED]*

### 2.1 The one-line

**Quartermaster is an autonomous agent that keeps a fleet of AI agents solvent so they never stop running.**

### 2.2 The problem

x402 turned every API into a pay-per-call endpoint. AI agents now pay for their own data — Zerion calls, LLM inference, search, storage. Each subordinate agent holds a small USDC balance in a hot wallet on Base. When that balance empties, the agent stops mid-task. Worse: an agent that ran out of funds three days into a long-running workflow has failed silently and the human doesn't know.

Meanwhile, the principal earns yield on other positions — staked ETH, Aave USDC, sDAI — that could be funding the fleet but isn't.

Today this is manual. The human babysits a spreadsheet of agent wallet balances and tops them up when they remember. Ugly, error-prone, doesn't scale past 3 agents.

### 2.3 The product

A policy-bound autonomous agent that:
1. **Watches** a fleet of subordinate agent wallets on Base
2. **Measures** their USDC burn rate from recent tx history
3. **Projects** when each wallet runs dry
4. **Decides** which source position to liquidate (lowest-yield-first)
5. **Executes** the swap + bridge + send flow to top up the subordinate wallet
6. **Refuses** to act when its policies block the action — and says why, loudly

All trading routes through the forked Zerion CLI. All signing is gated by OWS policies. Quartermaster runs as a daemon with its own agent token.

### 2.4 The narrative framing (use this in demo + README + landing)

> "This isn't a DeFi agent. This is the treasury layer for the agent economy."

Not "an agent that trades." Not "an agent that rebalances." An agent whose sole purpose is to keep other agents alive. The first org chart in the machine economy.

---

## Section 3 — Defensibility & Adversary Model *[LOCKED]*

### 3.1 Payments-prior framing (Phase B heuristic)

The hackathon's strongest thesis: payments-prior submissions win disproportionately. Quartermaster IS payments-prior — every action is an onchain payment from treasury to subordinate. The product *is* a payment graph.

We surface this on the landing page first paragraph and in the demo opening line.

### 3.2 30-second test

Tim must be able to deliver this in 30 seconds, in a noisy room, to a non-technical observer:

> "x402 makes AI agents pay USDC per API call. They run dry. Quartermaster is a single-purpose agent that watches a fleet, projects when each one will starve, and tops them up from your yield positions — but only within five composable policies you set. It's the treasury department for the machine economy. Built on Zerion's CLI, fully open source, fork it and add your own policies."

114 words. ~28 seconds at conversational pace. Memorize.

### 3.3 Defensibility: WHAT / WHY / HOW

**WHAT** is the moat — three layers:

1. **The policy framework is the product.** Five new files in `cli/policies/` that compose with the upstream three. Anyone forking gets a working safety-first agent template, not just a script. Zerion will reference this as the canonical pattern. Network effects accrue to whoever defines the pattern first.
2. **The "fiduciary" framing is sticky.** "Treasury layer for the agent economy" reframes a wallet management problem as institutional infrastructure. Once a category has a name, the first product in the name wins disproportionately.
3. **The execution path is irreplicable.** Anyone copying us has to (a) understand the OWS+CAIP-2 binding, (b) write the watcher math correctly, (c) own the bridge timeout edge case, (d) get the policy short-circuit semantics right. These are 4 separate hard-won pieces.

**WHY** — because no one has done it. The primitives are 6 weeks old (PR #5 is April 2026, x402 V2 is December 2025, Linux Foundation x402 launch is April 2026). The window between "primitives exist" and "the unified-surface product gets named" is short. We close it.

**HOW** — described throughout this PRD. Concrete artifacts: `cli/policies/`, `cli/lib/qm/`, dashboard, demo video, landing page. Every component traceable to a section.

### 3.4 The single distinctive technical commitment (NeuroDegen lesson)

NeuroDegen's moat was cryptographic commit-reveal attestation. One technical thing no other entrant would replicate.

**Quartermaster's equivalent: a policy engine where every action is gated by ALL policies, every evaluation is logged with reason codes, and adding a new policy requires zero changes to other code.** The framework — not the product — is the durable artifact.

This is what the README leads with. This is what the GitHub repo's `cli/policies/README.md` shows in the first 50 lines.

### 3.5 The single J1 demo moment (Remlo lesson)

Remlo's demo centerpiece was "agent-as-employee on Solana, autonomous USDC salary claim." One indelible image judges remember.

**Quartermaster's J1: live policy refusal.** At 1:30 in the demo, Tim deliberately spikes a subordinate's burn rate. The daemon detects anomaly. burn-rate-oracle policy fires. Dashboard shows the blocked action with `BURN_RATE_ANOMALY_DETECTED`. Tim says: "It refused itself. No god-mode."

This is the screenshot judges screenshot. Every other moment in the demo serves this one.

### 3.6 Adversary model

The strongest competing submission likely looks like: "Telegram DCA bot, 5 scoped policies, real Base txs, polished UI." If that submission exists, what beats it?

- **Their narrative is small** (one user, one buy). Ours is **infrastructural** (a fleet, a treasury, an economy).
- **Their policies protect a single position**. Ours **compose into a framework** other devs fork.
- **Their demo is a cron firing.** Ours is **an agent refusing itself live.**
- **Their judges' takeaway:** "neat automation." Ours: "this is what the next 100 forks should look like."

Not contempt for the DCA bot — it's a fine submission. But Quartermaster is one tier up: not "I built an agent," but "I built the substrate the agents need."

---

## Section 4 — Target User & Core Value *[LOCKED]*

### 4.1 Primary user

A developer or ops engineer running a small fleet (2–20) of autonomous agents on Base.

Examples:
- Data pipeline operator running 5 agents that each poll Zerion, OpenAI, and a scraper every 30s
- Indie shipping 3 Telegram bots that each call LLM inference per message
- Trader running 4 strategy agents that each consume onchain data feeds

Existing wallet with yield-bearing positions. Does NOT want to give any agent a huge float (risk). Wants dynamic, policy-capped funding.

### 4.2 Secondary user

A DAO treasurer allocating grant funds to researchers whose agents produce reports. Policies cap per-recipient and per-period spend. This unlocks "agent grants" as a primitive.

### 4.3 The core value

**Solvency-as-a-service for autonomous agents, with cryptographic guardrails.** Set policy once. System runs forever. Agents don't starve. Principal doesn't over-expose.

---

## Section 5 — System Architecture *[LOCKED]*

### 5.1 Components

```
┌────────────────────────────────────────────────────────────┐
│                    PRINCIPAL (human)                       │
│         owns: Treasury Wallet, sets Policies               │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       │ creates agent token + policies
                       ↓
┌────────────────────────────────────────────────────────────┐
│                  QUARTERMASTER DAEMON                      │
│ ┌────────────┐  ┌────────────┐  ┌─────────────────────┐    │
│ │ Watcher    │→ │ Decider    │→ │ Executor            │    │
│ │ (cron)     │  │ (policy    │  │ (zerion CLI wrap)   │    │
│ │            │  │  engine)   │  │                     │    │
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
│  fungibles)             │   │ │swap     │  │ allowlist │ │
└─────────────────────────┘   │ │bridge   │  │ burn-rate │ │
                              │ │send     │  │ yield-curv│ │
                              │ │fleet    │  │ cooldown  │ │
                              │ │qm       │  │ max-action│ │
                              │ └─────────┘  └───────────┘ │
                              └────────────────────────────┘
                                          │
                                          ↓ onchain
                              ┌────────────────────────────┐
                              │  Base mainnet (settlement) │
                              │  + Eth, Arb (bridge source)│
                              └────────────────────────────┘
                                          │
                                          ↓ USDC lands in
                              ┌────────────────────────────┐
                              │  Subordinate Agent Wallets │
                              │  (each paying per-call     │
                              │   Zerion API via x402)     │
                              └────────────────────────────┘
```

### 5.2 Three-tier trust boundary

1. **Principal tier (human)** — owns seed phrase, treasury wallet, sets policies. Can revoke any agent token.
2. **Quartermaster tier (daemon)** — agent token with narrow signing authority. Can sign swap/bridge/send only within policy bounds. Cannot export keys, change policies, or transfer to un-allowlisted addresses.
3. **Subordinate tier (agent fleet)** — each has its own wallet, holds small USDC float, signs x402 EIP-3009 auths. Cannot signal Quartermaster to top up — only receive.

Architectural rule: **trust flows downward only.** Compromised subordinate cannot pull from Quartermaster. Compromised Quartermaster cannot exceed policy-capped outflow.

### 5.3 Tradeoffs accepted

- **Files over a database.** Reviewable via `cat ledger.jsonl`, no deploy story, atomic appends sufficient. Cost: no horizontal scale; we accept (single-user tool).
- **Local-only dashboard.** Daemon HTTP at `127.0.0.1:7402`. Cost: dashboard can't deploy to Vercel; we accept (it's an ops tool, not a public site).
- **Base-only fleet for MVP.** Cost: punts Solana/multi-chain subordinates; we accept (2-week scope, listed in §11 out-of-scope).
- **Subprocess to zerion CLI vs. importing modules.** Cost: process spawn overhead per action; we accept (clean trust boundary, easy to upgrade upstream, matches CLI as a stable interface).
- **No browser extension.** Cost: web users on the dashboard need the daemon running. We accept.

### 5.4 Where Zerion sits

Zerion CLI is the **execution layer**. Every onchain action is a subprocess call to `npx zerion <cmd>`. Zerion is also the **data layer** — balances, prices, PnL, tx history come from Zerion API via the CLI's read commands.

We do NOT bypass Zerion. We do NOT build our own routing. Zerion stays the execution engine; we stay creative with the policy + orchestration layer. Explicitly what the track rewards.

---

## Section 6 — Data Flow & State Machine *[LOCKED]*

### 6.1 States

```
IDLE → WATCH → DECIDE → POLICY_CHECK → EXECUTE → CONFIRM → IDLE
                            │             │          │
                            ↓             ↓          ↓
                         BLOCKED       ERROR/*    PARTIAL
```

### 6.2 Happy path

```
[IDLE]
  │ cron tick (default: 60s)
  ↓
[WATCH]   ── read all subordinate balances via `zerion analytics portfolio`
  │       ── compute burn rate from last N tx via `zerion analytics activity`
  │       ── project runway_hours per wallet
  │
  ├── runway_hours > THRESHOLD for all → [IDLE]
  │ at least one runway_hours <= THRESHOLD
  ↓
[DECIDE]  ── identify target wallet (lowest runway)
  │       ── compute top-up amount = burn_rate * TARGET_RUNWAY_HOURS, capped
  │       ── select source asset via yield-curve-preservation
  │       ── compute required chain hops (source chain → Base)
  ↓
[POLICY_CHECK] run all policies in order:
  │           1. allowlist (destination must be in fleet)
  │           2. max-per-action-cap (amount <= MAX_USDC_PER_ACTION)
  │           3. cooldown-window (no top-up to same wallet within COOLDOWN_MIN)
  │           4. burn-rate-oracle (anomaly check, see §8)
  │           5. yield-curve-preservation (source asset is lowest-yield)
  │
  ├── any policy rejects → [BLOCKED]
  │                        log reason, emit event, wait COOLDOWN_MIN, retry
  │ all pass
  ↓
[EXECUTE] ── if source chain != Base:
  │             swap source asset → USDC on source chain (`zerion trading swap`)
  │             bridge USDC source → Base (`zerion trading bridge`)
  │             wait for bridge delivery (poll positions API)
  │          send USDC Base → subordinate wallet (`zerion send`)
  │
  ├── any step fails → [ERROR/*]
  │                    log full tx trace, alert, wait, do NOT auto-retry
  │ all succeed
  ↓
[CONFIRM] ── verify subordinate wallet received USDC
  │       ── write action record to ledger
  │       ── emit `topup_confirmed` event
  ↓
[IDLE]
```

### 6.3 Failure states + concrete recovery *[LOCKED]*

| State | Trigger | Recovery |
|---|---|---|
| `BLOCKED` | Any policy rejects | Append `topup_blocked` to ledger with reason code. Wait `COOLDOWN_MIN`. Re-evaluate next tick |
| `ERROR/SWAP_FAILED` | Zerion swap returns non-200 OR tx reverts on chain | Abort. No retry. `topup_swap_failed` event. Surface in dashboard. Tim must manually intervene or wait for next tick |
| `ERROR/SWAP_PARTIAL` | Swap tx broadcast but never confirmed within `SWAP_TIMEOUT_SEC` (default 300) | Mark action `partial`. **Do not bridge.** Periodic confirmation poll for 6 hours. If confirmed, mark `swap_orphaned`: funds in QM wallet on source chain, requires `zerion qm reconcile <action_id>` to recover into normal flow |
| `ERROR/BRIDGE_TIMEOUT` | Bridge poll doesn't confirm within `BRIDGE_TIMEOUT_SEC` (default 900) | Mark `partial`. Funds remain in QM wallet on Base. Halt the wallet's queue. Require `zerion qm resume <wallet_id>` |
| `ERROR/SEND_FAILED` | Final send tx reverts | `topup_send_failed`. Funds in QM Base wallet. Manual `zerion send` to recover — but the wallet stays in fleet so next tick will re-attempt |
| `ERROR/INSUFFICIENT_TREASURY` | No source asset has enough balance to cover top-up after policy filter | `topup_aborted_no_source`. Suspend watcher on that target wallet for 24h. Alert |
| `ERROR/AGENT_TOKEN_REVOKED` | OWS returns "API key not found" | Suspend daemon. `daemon_halt`. Require human re-issue token + restart |
| `ERROR/RATE_LIMITED` | Zerion API 429 | Exponential backoff (10s, 30s, 90s, 270s, 810s). After 5 retries, halt the tick, resume next tick |
| `ERROR/UNKNOWN` | Any other exception | `daemon_panic`. Log full stack. Halt. Human reviews |

### 6.4 Idempotency *[LOCKED]*

Every action cycle:
1. Generates `action_id` (UUID v7) at `[DECIDE]` step
2. Writes `topup_planned` to ledger with full plan + policy results BEFORE first tx
3. Each tx step writes `topup_<step>_pending` then `topup_<step>_confirmed` (or `_failed`)
4. On daemon restart, reads ledger tail. If any action is `pending` without `confirmed` or `failed`, runs RECONCILE:
   - For each pending step, query Zerion's tx status
   - If tx confirmed: write `*_confirmed_orphaned`, alert human, do NOT advance state machine without human confirm
   - If tx not yet broadcast: safe to discard, write `topup_aborted_restart`
   - If tx broadcast but pending: wait for finality, then orphan as above

**No automatic resume of orphaned actions.** Human reads dashboard, runs `zerion qm reconcile <action_id> --confirm`, action advances.

### 6.5 Re-entrancy

The watcher tick is non-overlapping. A tick that starts at T+0 must complete (or short-circuit) before the tick at T+60 fires. Implementation: `tick_in_flight` boolean in daemon memory; if true at next cron, log `tick_skipped_overlap` and skip.

If a tick overlaps repeatedly (>3 consecutive skips), daemon emits `tick_overlap_alert` and lengthens `QM_TICK_SECONDS` automatically by 50% (max 10 minutes). Manual reset via `zerion qm tune --tick=N`.

---

## Section 7 — Domain Model *[LOCKED]*

```typescript
type SubordinateWallet = {
  id: string                  // user-chosen label, [a-z0-9-]{2,32}
  address: `0x${string}`
  chainId: 'eip155:8453'      // Base mainnet (or eip155:84532 for Base Sepolia)
  targetRunwayHours: number   // default 72
  minRunwayHours: number      // trigger threshold, default 24
  minUsdcBalance: number      // hard floor, default 5
  notes?: string
  createdAt: string           // ISO
}

type TreasurySource = {
  id: string
  walletAddress: `0x${string}`   // principal's wallet
  chainId: string                // CAIP-2
  assetContract: `0x${string}` | 'native'
  symbol: string                 // 'USDC', 'stETH', 'sDAI'
  currentApyEstimate: number     // updated by watcher
  apyLastUpdated: string         // ISO
  minRetainedBalance: number     // never drain below
  priority: number               // tie-breaker; lower = drain first
}

type BurnRateSample = {
  walletId: string
  usdcBalance: number
  sampledAt: string
  last24hSpend: number
  last7dSpend: number
  ewmaHourlyBurn: number          // see §8.3 for formula
  runwayHours: number
}

type TopUpAction = {
  actionId: string                // UUIDv7
  targetWalletId: string
  topUpAmountUsdc: number
  sourceId: string
  state: 'planned' | 'swap_pending' | 'swap_confirmed' | 'bridge_pending' |
         'bridge_confirmed' | 'send_pending' | 'confirmed' | 'blocked' |
         'partial' | 'error'
  txHashes: {
    swap?: `0x${string}`
    bridge?: `0x${string}`
    send?: `0x${string}`
  }
  policyChecks: {
    policyName: string
    passed: boolean
    reasonCode?: string            // e.g., 'BURN_RATE_ANOMALY_DETECTED'
    reasonText?: string
    evaluatedAt: string
  }[]
  reasonCodeFinal?: string         // if blocked or error
  createdAt: string
  confirmedAt?: string
  errorDetails?: string
}

type LedgerEvent =
  | { type: 'tick_started'; tickId: string; ts: string }
  | { type: 'tick_skipped_overlap'; ts: string }
  | { type: 'tick_completed'; tickId: string; durationMs: number; ts: string }
  | { type: 'wallet_observed'; walletId: string; sample: BurnRateSample }
  | { type: 'topup_planned'; action: TopUpAction }
  | { type: 'topup_blocked'; actionId: string; reasonCode: string; reasonText: string }
  | { type: 'topup_swap_pending'; actionId: string; txHash: string }
  | { type: 'topup_swap_confirmed'; actionId: string; txHash: string; gasUsed: number }
  | { type: 'topup_bridge_pending'; actionId: string; txHash: string }
  | { type: 'topup_bridge_confirmed'; actionId: string; txHash: string }
  | { type: 'topup_send_pending'; actionId: string; txHash: string }
  | { type: 'topup_send_confirmed'; actionId: string; txHash: string }
  | { type: 'topup_confirmed'; actionId: string; finalBalance: number }
  | { type: 'topup_aborted_no_source'; actionId: string }
  | { type: 'daemon_halt'; reason: string }
  | { type: 'daemon_panic'; stack: string }
  | { type: 'agent_token_validated'; ts: string }
  | { type: 'reconcile_started'; sessionId: string }
  | { type: 'reconcile_resolved'; actionId: string; resolution: string };

// Every event written to ledger.jsonl is one of the above.
```

---

## Section 8 — Policy Engine Design *[LOCKED]*

This is the 25% of the score that separates us from every other entrant. Most ship one policy. We ship a composable system.

### 8.1 Policy contract

Every policy is a single file under `cli/policies/`. Exports:

```typescript
export const policyName: string    // unique slug
export const policyVersion: string // semver

export async function evaluate(context: PolicyContext): Promise<PolicyResult>
```

`run-policies.mjs` (already in PR #5) calls each policy in registered order. First failure short-circuits and returns reason.

### 8.2 The five policies Quartermaster ships

| # | Name | File | Purpose |
|---|---|---|---|
| 1 | `allowlist` | upstream | Destination must be in fleet allowlist |
| 2 | `max-per-action-cap` | new | Top-up ≤ MAX_USDC_PER_ACTION (default 100) |
| 3 | `cooldown-window` | new | No second top-up to same wallet within COOLDOWN_MIN (default 30) |
| 4 | `burn-rate-oracle` | new | Confirms projected runway is below threshold; rejects if burn rate looks manipulated |
| 5 | `yield-curve-preservation` | new | Source asset must be the lowest-APY available source with sufficient balance |

Plus existing upstream policies unchanged: `deny-approvals`, `deny-transfers`.

### 8.3 burn-rate-oracle math *[LOCKED]*

The policy uses Exponentially Weighted Moving Average over the last 24h of subordinate tx outflow.

```
ewma_hourly_burn(t) = α · spend_in_last_hour(t) + (1 - α) · ewma_hourly_burn(t - 1h)
α = 0.30  // half-life ≈ 2 hours
```

Stored per-wallet, updated each tick.

**Anomaly detection — three checks, ALL must pass for the policy to allow the action:**

1. **Sustained-need check.** Mean burn rate over last 24h must be > 0. Rejects on `NO_SUSTAINED_BURN`.
2. **Spike-vs-baseline check.** `recent_hour_burn / 7d_baseline_hourly_burn` ≤ 10. Rejects on `BURN_RATE_ANOMALY_DETECTED` if exceeded. (The "10x" threshold is a conservative number: real ramp-ups in usage rarely exceed 10x in an hour without operator action.)
3. **Runway-validity check.** Computed `runway_hours = current_balance / ewma_hourly_burn` < `minRunwayHours`. Rejects on `RUNWAY_NOT_BELOW_THRESHOLD` (defensive; should already be filtered by watcher, but if a stale read slipped through we catch it here).

Tunable via `~/.zerion/quartermaster/policies.json`:
```json
{
  "burn-rate-oracle": {
    "alpha": 0.30,
    "spike_threshold": 10,
    "min_24h_total_spend": 0.01
  }
}
```

### 8.4 yield-curve-preservation logic *[LOCKED]*

```
1. List all TreasurySource where balance >= top_up_amount + minRetainedBalance
2. Sort by (currentApyEstimate ASC, priority ASC)
3. Selected source = sorted[0]
4. If decider proposed source != selected source:
     reject with reason YIELD_CURVE_VIOLATION
     reasonText: "Proposed source X (APY n%) is not lowest; Y (APY m%) was eligible"
```

Implications:
- USDC sitting idle (APY 0%) is always selected first
- Aave USDC (APY ~3%) before stETH (APY ~3.2%) before sDAI (APY ~5%), etc.
- Tie-breaker is `priority` (manually configured; lower drains first)

### 8.5 cooldown-window *[LOCKED]*

```
1. Read ledger for last `topup_confirmed` for `targetWalletId`
2. If now - lastConfirmed.ts < COOLDOWN_MIN minutes: reject COOLDOWN_VIOLATION
```

Default COOLDOWN_MIN = 30. Tunable.

### 8.6 max-per-action-cap *[LOCKED]*

```
if topUpAmountUsdc > MAX_USDC_PER_ACTION: reject CAP_EXCEEDED
```

Default 100 USDC. Tunable.

### 8.7 Composition rules *[LOCKED]*

- ALL-must-pass, never majority or weighted
- Pure evaluators — cannot mutate state
- Adding a policy = drop a file in `cli/policies/`, register in `run-policies.mjs`, no other code change
- Failures must include reasonCode (machine) + reasonText (human)
- All evaluations logged to ledger as `policyChecks[]` on the action

### 8.8 Why each policy is novel (pitch this)

- **burn-rate-oracle** is not a "spend limit" — it's a **reality check** confirming the on-the-ground observation that motivated the action. If burn rate spikes 10x in an hour, that's anomalous, not real demand.
- **yield-curve-preservation** is **economic rationality as policy**. Can't liquidate stETH if USDC cash would have covered. Constraint on *which* asset, not *how much*.
- **cooldown-window** prevents runaway loops — if something is broken and a wallet keeps hemorrhaging, cooldown forces human-in-the-loop.

---

## Section 9 — Forked CLI Extensions *[DEFAULT — verify upstream first]*

> Before editing the fork: run §0.2 protocol on `zerion-ai` `merge-wallet-cli` branch. Paths/commands below may have drifted.

### 9.1 New commands

| Command | Purpose |
|---|---|
| `zerion fleet add <wallet-id> <address>` | Register subordinate |
| `zerion fleet list` | Show fleet + runway |
| `zerion fleet remove <wallet-id>` | Deregister |
| `zerion fleet status` | Burn-rate snapshot |
| `zerion treasury add <source-id> <address> <symbol> <chain>` | Register source position |
| `zerion treasury list` | Show sources + APY |
| `zerion qm run` | Start daemon |
| `zerion qm pause` | Pause without exit |
| `zerion qm resume <wallet-id?>` | Resume (specific wallet or all) |
| `zerion qm plan <wallet-id>` | Dry-run, no tx |
| `zerion qm policy set <name> <param>=<value>` | Tune policy |
| `zerion qm policy get <name>` | Read current policy config |
| `zerion qm reconcile <action-id>` | Resolve a `partial` action |
| `zerion qm tune --tick=N` | Adjust tick interval |
| `zerion qm test spike --wallet=<id> --rate=<usdc/h>` | (Test-only) inject burn-rate spike for demo |

### 9.2 New policies (file paths)

```
cli/policies/
  ├── (upstream) allowlist.mjs
  ├── (upstream) deny-approvals.mjs
  ├── (upstream) deny-transfers.mjs
  ├── (upstream) run-policies.mjs   ← register new policies here
  ├── max-per-action-cap.mjs        ← new
  ├── cooldown-window.mjs           ← new
  ├── burn-rate-oracle.mjs          ← new
  └── yield-curve-preservation.mjs  ← new
```

### 9.3 New lib modules

```
cli/lib/
  ├── (upstream...)
  ├── fleet/
  │   └── registry.js          // CRUD on fleet.json
  ├── treasury/
  │   └── sources.js            // CRUD on treasury.json
  └── qm/
      ├── watcher.js            // tick loop, balance fetch
      ├── decider.js            // target/source/amount selection
      ├── executor.js           // wraps zerion commands as subprocess
      ├── ledger.js             // append-only jsonl
      ├── reconcile.js          // partial-state resolver
      ├── http-server.js        // local-only HTTP API for dashboard
      ├── apy.js                // yield estimation per source
      └── ewma.js               // burn rate math
```

### 9.4 What we do NOT change

- Existing `wallet`, `trading`, `agent`, `analytics`, `send` commands — use as-is
- Existing policies — add to, never modify
- OWS signing flow — agent tokens used same way as upstream
- Crypto/keystore code — touch and bugs multiply

### 9.5 Upstream upgrade strategy

When upstream zerion-ai ships changes (likely within 2 weeks of submission), our fork must rebase cleanly. So:
- All new code in **new files**, never edits to existing
- Entry points hook through `router.js` by adding command registrations, not modifying
- If we MUST modify an upstream file: wrap change in `// QUARTERMASTER:BEGIN ... // QUARTERMASTER:END` blocks for trivial rebase

---

## Section 10 — Runtime: The Daemon *[DEFAULT]*

### 10.1 Execution model

`zerion qm run` starts a Node process that:
- Runs tick loop every `QM_TICK_SECONDS` (default 60)
- Each tick: WATCH → DECIDE → POLICY_CHECK → EXECUTE → CONFIRM
- Serializes state to `~/.zerion/quartermaster/`
- Logs structured JSON to stdout + daily file
- Exposes local HTTP server on `127.0.0.1:7402` (the "402" is intentional — homage to the protocol)

### 10.2 Concurrency rules

- **One daemon per user.** Lock file at `~/.zerion/quartermaster/.lock`. Second invocation exits.
- **One action at a time.** Fleet processed sequentially. If A and B both need top-up, A first, B next tick.
- **No parallel chain hops.** Swap → bridge → send strictly sequential.

### 10.3 Lifecycle signals

- `SIGINT`/`SIGTERM` — finish current action, write ledger, exit clean
- `SIGHUP` — reload fleet + treasury config from disk without restart
- Unhandled exception — write `daemon_panic` to ledger, exit non-zero

### 10.4 Tick lifecycle event sequence

Every tick emits:
```
tick_started → wallet_observed (×N) → [topup_planned → topup_*_pending → topup_*_confirmed → topup_confirmed]?
             → tick_completed
```

If no top-up needed: just `tick_started` → `wallet_observed` (×N) → `tick_completed`.

---

## Section 11 — Out of Scope *[LOCKED]*

Things explicitly NOT built in the hackathon window:
- Multi-chain fleet wallets (MVP Base-only)
- EVM chain diversity beyond {Ethereum, Arbitrum, Base} for treasury
- Solana as a source chain
- Email/Discord/Telegram alerts (stub interface, don't wire)
- Multi-user SaaS deployment
- Agent token rotation automation
- Governance layer for policy changes
- UI for policy editing (CLI only)
- Cost basis / tax tracking
- Tokenomics, airdrop, points
- Browser extension

If a judge asks "why not Solana?" the honest answer: "2-week scope, Zerion supports it, 3 days of work we punted. Post-hackathon."

---

## Section 12 — Interface Layer *[LOCKED for structure]*

Three surfaces:
1. **CLI** — primary surface
2. **Dashboard (web, local-only)** — viewer, polls daemon
3. **Landing page (web, public)** — marketing, post-hackathon distribution

CLI is source of truth. Dashboard is a viewer. Dashboard never does what CLI can't.

---

## Section 13 — Storage & Persistence *[LOCKED]*

```
~/.zerion/
├── config.json              (upstream — don't touch)
├── keystore/                (upstream — encrypted wallets)
└── quartermaster/
    ├── fleet.json           (SubordinateWallet[])
    ├── treasury.json        (TreasurySource[])
    ├── policies.json        (policy configuration overrides)
    ├── ledger.jsonl         (append-only LedgerEvent records)
    ├── samples.jsonl        (append-only BurnRateSample, for charts)
    ├── apy-cache.json       (per-source APY snapshots, refreshed hourly)
    ├── .lock                (pid + started_at)
    └── logs/
        └── YYYY-MM-DD.log
```

Backup: user's responsibility. README warns. Keystore handled by upstream zerion CLI.

### 13.1 File rotation

- `ledger.jsonl` rotated at 50MB; archived as `ledger-YYYY-MM-DD.jsonl.gz`
- `samples.jsonl` rotated at 10MB
- Logs deleted after 30 days

### 13.2 Atomicity

All writes use `fs.openSync(path, 'a')` for appends. Config writes use `fs.writeFileSync(temp); fs.renameSync(temp, real)` for atomic swap.

---

## Section 14 — Security Model *[LOCKED]*

### 14.1 Layer / mechanism / enforcement (per Rule C9)

| Layer | Threat | Mechanism | Enforcement |
|---|---|---|---|
| Principal wallet | Seed exposure | Encrypted keystore, never in process memory long-term | Upstream zerion-cli; we don't touch keystore code |
| Agent token | Token leakage | Token redacted from stdout/stderr; saved only to config.json | Upstream zerion-cli (per PR #5) — note reviewer's open finding on `config list/get agentToken` redaction; we echo this warning in our README |
| Agent token | Token misuse beyond scope | OWS validates at sign time using CAIP-2 chain ID + policy match | OWS engine + zerion-cli `signTransaction` flow |
| Top-up amount | Excessive single send | `max-per-action-cap` policy + upstream `deny-transfers` ceiling (belt-and-suspenders) | Policy engine, evaluated before signing |
| Top-up destination | Send to attacker address | `allowlist` policy: destination must be in `fleet.json` | Policy engine |
| Top-up frequency | Repeated drain | `cooldown-window` policy: per-wallet 30min minimum | Policy engine |
| Burn-rate input | Manipulation by spamming subordinate | `burn-rate-oracle` policy: 10x baseline anomaly check | Policy engine |
| Source asset choice | Drain of high-yield position | `yield-curve-preservation` policy: must select lowest-APY source | Policy engine |
| Approval signing | Unlimited token approval grant | `deny-approvals` policy | Upstream policy |
| Policy file integrity | Attacker edits policy file | POLICIES_DIR resolved at runtime (zerion-cli commit `6100f1d` fix). Future: hash check at startup | Filesystem permissions; daemon-startup hash log (to-do) |
| Bridge timeout | Funds stuck | State machine halts at `BRIDGE_TIMEOUT`; manual recovery via `zerion qm reconcile` | Daemon state machine |
| Daemon process compromise | Memory read | Agent token + 5 policies cap blast radius | Defense-in-depth: even with token, attacker can't exceed cap or send to non-fleet |
| Subordinate compromise | Drain attempt | Subordinates only RECEIVE; have no role in decision | Architectural — subordinate has no daemon RPC |
| Oracle manipulation | False APY | APY data from Zerion's own data layer (same source principal trusts for portfolio) | Out of scope; Zerion data integrity is upstream concern |
| Daemon HTTP exposure | Remote access | Bound to `127.0.0.1` only; no auth required because no remote | Network bind; refuses non-loopback origins |

### 14.2 What Quartermaster CANNOT do

- Move any asset not in `treasury.json`
- Send to any address not in `fleet.json`
- Exceed MAX_USDC_PER_ACTION
- Top up same wallet within COOLDOWN_MIN
- Sign approvals (`deny-approvals`)
- Export/display seed phrase (upstream)
- Modify own policy files at runtime

### 14.3 What the user must do

- Create QM wallet via `zerion wallet create --agent` (separate from main wallet)
- Configure policies via `zerion qm policy set`
- Review ledger before deploying mainnet with real funds
- Run on testnet first via `--testnet` flag → Base Sepolia

---

## Section 15 — Observability & Events *[LOCKED]*

### 15.1 Structured event log (per Rule C8)

Every state change emits a `LedgerEvent` (§7). One event per JSONL line. No prose strings as primary event payload.

Required fields on every event:
- `type` (string, enum from §7)
- `ts` (ISO-8601, UTC)
- `tickId` or `actionId` where applicable
- structured payload (no `message: "..."` blobs)

### 15.2 Structured logs (separate from events)

Application logs go to `~/.zerion/quartermaster/logs/YYYY-MM-DD.log`. Log lines:

```json
{
  "ts": "2026-04-23T14:30:15.123Z",
  "level": "info|warn|error|panic",
  "component": "watcher|decider|policy|executor|confirmer|reconciler|http",
  "tickId": "t-2026-04-23-14-30-00",
  "actionId": "01HRXY...",
  "walletId": "alpha",
  "msg": "human-readable",
  "data": { ... }
}
```

### 15.3 Metrics surfaced

Dashboard:
- Fleet: total wallets, total USDC float, aggregate burn rate, min runway
- Treasury: total USD value, source count, weighted APY
- Actions (24h): count, blocked count, error count, total USD moved, success rate
- Policies (24h): per-policy pass/fail count

### 15.4 Alert stubs (interface only, not wired)

`~/.zerion/quartermaster/alerts.json`:
```json
{ "webhooks": [{ "url": "https://...", "events": ["topup_blocked", "daemon_halt"] }] }
```

Daemon checks file existence; if present, makes the POST. We DO implement the dispatch — just don't ship pre-configured alert destinations. Reviewers see the affordance.

---

## Section 16 — Design System: "Specie" *[LOCKED]*

Theme name: **Specie** — archaic word for hard currency, literal metal coins. Evokes treasury, weight, permanence.

**Why this palette:** product is about solvency, trust, long-running operations. Crypto-neon and cyberpunk signal "risk." We go opposite: parchment, patina, antique gold, slate. A nineteenth-century counting house ledger rendered in a terminal.

**Not used in any prior Tim project.** NeuroDegen was warm amber on deep neutral; Remlo SWARM had its own palette; LocalRx was dark-navy + medical-green; Tessera + Citrea had separate branding. Fresh territory.

### 16.1 Color tokens

#### Dark mode (default)

```css
:root[data-theme="dark"] {
  /* Surfaces */
  --color-bg:              #0B0D0E;
  --color-surface-1:       #141719;
  --color-surface-2:       #1C1F22;
  --color-surface-3:       #272B2F;
  --color-border-subtle:   #2A2E32;
  --color-border-strong:   #3B4046;

  /* Text */
  --color-text-primary:    #ECE8DE;  /* bone */
  --color-text-secondary:  #A8A39A;
  --color-text-muted:      #6B6862;
  --color-text-inverse:    #0B0D0E;

  /* Brand / actions */
  --color-accent:          #C9A961;  /* antique gold */
  --color-accent-hover:    #D4B572;
  --color-accent-muted:    #7C683B;

  /* Semantic */
  --color-success:         #6B7F5E;  /* sage */
  --color-warning:         #D4703F;  /* burnt sienna */
  --color-danger:          #8B2A26;  /* oxblood */
  --color-info:            #3A4D52;  /* slate teal */

  /* Charts */
  --chart-1: #C9A961;
  --chart-2: #6B7F5E;
  --chart-3: #3A4D52;
  --chart-4: #D4703F;
  --chart-5: #8B2A26;
  --chart-6: #A8A39A;
}
```

#### Light mode

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

### 16.2 Contrast verification *[Day 0 task]*

Computed expectations:
- Text-primary `#ECE8DE` on bg `#0B0D0E`: ≈14.8:1 (AAA)
- Accent `#C9A961` on bg `#0B0D0E`: ≈8.9:1 (AAA large, AA normal)
- Warning sienna `#D4703F` on bg `#0B0D0E`: ≈5.8:1 (AA normal — pass)
- Danger oxblood `#8B2A26` on bg `#0B0D0E`: ≈3.1:1 (FAIL — only use for filled badges, never as text on bg)

Day 0 verification: run automated contrast check via `pa11y` or manual via WebAIM. If oxblood fails AA in real measurement, shift to `#A53A36`. Log to DEVIATIONS.md.

### 16.3 Typography

| Role | Font | Fallback | Size | Weight |
|---|---|---|---|---|
| Display (landing hero) | **Fraunces** (variable, opsz) | Georgia, serif | 48–72px | 400, opsz 144 |
| Heading | **Inter** | system-ui | 24–36px | 500 |
| Body | **Inter** | system-ui | 15px | 400 |
| UI label | **Inter** | system-ui | 13px | 500, tracking +0.02em |
| Mono (addresses, hashes, code) | **JetBrains Mono** | ui-monospace | 13–14px | 400 |
| Numeric (stats) | **Inter**, `tnum` on | system-ui | varies | varies, tabular-nums always |

Fraunces ONLY on landing. App uses Inter + JetBrains Mono.

### 16.4 Spacing & layout

- Base unit: 4px. Spacing multiples: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96
- Max content width: 1200px (dashboard), 960px (marketing)
- Card padding: 20px (dense), 32px (landing)
- Border radius: 6px (cards, inputs), 2px (pills, badges), 0px (tables)

### 16.5 Motion

- Transitions: 160ms ease-out default, 240ms dialogs
- NO page-load animations, parallax, auto-playing GIFs
- Permitted: 2-frame "pulse" on values that updated (200ms, opacity 60%→100%)

### 16.6 Iconography

- **Lucide React**, stroke 1.5px uniformly
- No emoji in UI chrome (OK in marketing)

### 16.7 Component patterns

- **Cards**: 1px `--color-border-subtle` border, no shadow in dark; in light, 1px `--color-border-strong` + 1px inset shadow
- **Stats**: tabular-nums, label above value, unit after value in muted color
- **Status pills**: success sage, warning sienna, danger oxblood, info slate; 30% alpha bg in dark, solid in light
- **Tables**: zebra in light only; dark relies on `--color-border-subtle` between rows
- **Buttons**: primary filled accent, secondary outline accent, tertiary text-only with underline on hover. NO gradients, glows

---

## Section 17 — Landing Page *[ADVISORY]*

### 17.1 Purpose

(a) Hackathon judges orient in 30s. (b) Post-hackathon canonical "what is Quartermaster" page. (c) Forkers find the docs link.

### 17.2 Structure (single page)

1. **Hero** — display heading "Keep your agents solvent." Subhead: "Quartermaster is an autonomous treasury agent that funds your AI agent fleet — within cryptographic policy bounds, 24/7." Two buttons: "View on GitHub" / "Read the docs". Visual: 8-second asciinema embed of `zerion fleet status` → tick → top-up → ledger.
2. **The problem** — 3 paragraphs.
3. **The architecture** — single diagram (cleaner version of §5.1).
4. **The five policies** — card grid; per card: name, one-line, icon, "view source" link.
5. **Built on Zerion** — logo strip, one-line credit, Zerion API key CTA.
6. **Demo video** — 2-min recorded demo.
7. **Footer** — GitHub, hackathon link, Tim's handle.

### 17.3 Writing rules

- No marketing puffery. "Revolutionary," "first-ever," "game-changing" are banned.
- Sentences short. Paragraphs ≤ 3 sentences.
- Every claim falsifiable or links to source.
- Technical terms defined inline first time.

### 17.4 Lead copy *[LOCKED]*

(DarkOdds lesson: lead with concrete capability + chain + distinguishing technical claim, not vibes.)

> "Live on Base. Five composable policies. Signs only what they permit."

This appears under the hero subhead, in muted secondary text, in JetBrains Mono.

---

## Section 18 — App Shell (Dashboard) *[ADVISORY]*

### 18.1 Layout

Two-pane: 240px left nav, flexible main.

Left nav: Overview, Fleet, Treasury, Actions, Policies, Settings. Bottom: daemon status pill (green/amber/red) + "Pause" button.

### 18.2 Overview screen (the demo screen)

Above-fold at 1440×900:

```
┌─────────────────┬─────────────────┬─────────────────┐
│ FLEET           │ TREASURY        │ ACTIONS (24h)   │
│ 5 wallets       │ $8,420.17       │ 12 top-ups      │
│ Min runway: 14h │ 3 sources       │ 0 blocked       │
│ Total float:    │ Weighted APY:   │ 0 errors        │
│ $42.30          │ 4.8%            │ $124.00 moved   │
└─────────────────┴─────────────────┴─────────────────┘
┌───────────────────────────────────────────────────────┐
│ RUNWAY (stacked bars per wallet, colored by health)   │
└───────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────┐
│ RECENT ACTIONS (table, ledger tail, last 10)          │
│ time | wallet | amount | state | tx (Basescan link)   │
└───────────────────────────────────────────────────────┘
```

Runway chart and ledger update live.

### 18.3 Live update mechanism

- Dashboard polls `127.0.0.1:7402/api/state` every 5s
- On tick boundaries, daemon emits SSE; dashboard listens optionally for instant updates during demo
- If daemon offline, prominent "Daemon offline — run `zerion qm run`" banner

### 18.4 What dashboard does NOT do

- No wallet creation (CLI only)
- No policy editing (CLI only)
- No tx signing (CLI only via OWS)
- No private data display (never seeds, keys, raw agent tokens)

---

## Section 19 — Frontend Engineering Rules *[LOCKED]*

### 19.1 Stack

- **Next.js 15** (app router) — verify before install
- **React 19** stable
- **Tailwind v4** (CSS-first, `@import "tailwindcss"`)
- **shadcn/ui** for base — install via CLI, customize tokens
- **Recharts** for runway chart
- **Lucide React** for icons
- No other UI libraries. No Framer Motion, Headless UI, etc. Small surface.

### 19.2 File organization

```
apps/
├── landing/                     # Next.js, marketing
│   ├── app/
│   ├── components/
│   └── public/
├── dashboard/                   # Next.js, ops dashboard
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── overview/page.tsx
│   │   ├── fleet/page.tsx
│   │   ├── treasury/page.tsx
│   │   ├── actions/page.tsx
│   │   ├── actions/[id]/page.tsx
│   │   ├── policies/page.tsx
│   │   └── settings/page.tsx
│   ├── components/
│   │   ├── ui/                  # shadcn primitives
│   │   ├── stats-card.tsx
│   │   ├── runway-chart.tsx
│   │   ├── ledger-table.tsx
│   │   ├── policy-card.tsx
│   │   ├── wallet-row.tsx
│   │   └── daemon-status-pill.tsx
│   └── lib/
│       └── daemon-client.ts     # HTTP client to local daemon
packages/
└── shared-schemas/              # zod schemas shared with daemon
```

### 19.3 Component rules

- One component per file. Named export AND default export.
- Props typed with explicit interfaces. No `any` ever; use `unknown` and narrow.
- Server components by default. `'use client'` only where needed.
- Data fetching: server components, fetch against `127.0.0.1:7402`. → cannot deploy dashboard to Vercel; runs locally.

### 19.4 Styling rules

- CSS variables in `globals.css`. No hardcoded hex.
- Tailwind utilities via var: `bg-[var(--color-surface-1)]` or extend Tailwind config to expose as `bg-surface-1`
- No inline `style=` except truly dynamic (chart bar widths)
- No CSS-in-JS

### 19.5 Accessibility baseline

- Contrast: AA minimum (Day 0 verifies — §16.2)
- Keyboard reach for all interactive elements; visible focus rings (2px accent outline, 2px offset)
- Tables use real `<th>`
- Decorative icons `aria-hidden`; icon-only buttons `aria-label`
- Theme toggle keyboard-operable

### 19.6 Performance budget

- Dashboard initial JS: < 200KB gzipped
- No heavy libs (tree-shake date-fns, no lodash full)
- Images: AVIF first, WebP fallback, never raw PNG > 50KB

---

## Section 20 — Component Library Inventory *[DEFAULT]*

shadcn/ui components needed (install via `npx shadcn-ui add <name>`):

| Component | Where used |
|---|---|
| `button` | Everywhere |
| `card` | Stats, policy cards, wallet rows |
| `table` | Ledger, fleet list, treasury list |
| `tabs` | Overview / Fleet / Actions tabs |
| `dialog` | Action detail modal |
| `badge` | Status pills (with custom color tokens) |
| `tooltip` | Hover hints on stats |
| `separator` | Between sections |
| `scroll-area` | Long ledger, settings |
| `skeleton` | Loading state |

Custom components (not from shadcn):

| Component | File | Purpose |
|---|---|---|
| `StatsCard` | `components/stats-card.tsx` | Three KPI cards on Overview |
| `RunwayChart` | `components/runway-chart.tsx` | Recharts horizontal stacked bar |
| `LedgerTable` | `components/ledger-table.tsx` | Live action list |
| `PolicyCard` | `components/policy-card.tsx` | Per-policy summary |
| `WalletRow` | `components/wallet-row.tsx` | Fleet list row with runway pill |
| `DaemonStatusPill` | `components/daemon-status-pill.tsx` | Green/amber/red lock + label |
| `TxLink` | `components/tx-link.tsx` | Basescan deep-link for hashes |

---

## Section 21 — Tech Stack & Pinned Versions *[DEFAULT — Day 0 verifies]*

### 21.1 Language & runtime

- **TypeScript 5.x** for everything we write (CLI fork keeps upstream JS style)
- **Node 22 LTS** — zerion-cli requires it
- **pnpm** for workspace management

### 21.2 Pinned versions table

These are starting points. Day 0 verification updates them.

| Package | Version (start) | Verify before |
|---|---|---|
| node | 22.x LTS | Phase 0 |
| pnpm | 9.x | Phase 0 |
| typescript | 5.5+ | Phase 1 |
| next | 15.0+ | Phase 9 |
| react | 19.0+ | Phase 9 |
| tailwindcss | 4.0+ | Phase 9 |
| recharts | 2.12+ | Phase 9 |
| lucide-react | latest | Phase 9 |
| zod | 3.23+ | Phase 2 |
| hono | 4.x | Phase 8 |
| pino | 9.x | Phase 8 |
| uuid | 10+ | Phase 7 |
| viem | 2.x (matches upstream) | Phase 1 |
| @open-wallet-standard/core | match upstream | Phase 1 |

### 21.3 Why no database

- No deploy story
- File appends atomic enough for append-only ledger
- Reviewers `cat ledger.jsonl` and see the audit trail
- Sqlite trivial to add post-hackathon if needed

### 21.4 Deployment targets

| Surface | Deploy target |
|---|---|
| Forked CLI | npm under `@<scope>/zerion-fork` (optional; primary distribution is GitHub) |
| Dashboard | LOCAL only — runs alongside the daemon on the user's machine |
| Landing page | Vercel — free tier, custom domain |
| Documentation | Same Vercel deploy as landing, under `/docs` (markdown rendered) |

(Per Rule C12 default Vercel+Railway+Supabase: we use Vercel for landing, no Railway/Supabase needed because no database / no remote state.)

---

## Section 22 — Repository Structure & Route Map *[DEFAULT]*

### 22.1 Monorepo layout

```
quartermaster/
├── README.md
├── AGENT_PROGRESS.md            # see §28
├── docs-verified/
│   ├── DEVIATIONS.md
│   ├── zerion-cli.md
│   ├── zerion-api.md
│   ├── x402.md
│   └── ...
├── .env.example
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
│
├── cli/                         # forked zerion-ai
│   ├── (upstream files)
│   ├── commands/fleet/
│   ├── commands/treasury/
│   ├── commands/qm/
│   ├── lib/qm/
│   ├── lib/fleet/
│   ├── lib/treasury/
│   └── policies/
│       ├── (upstream)
│       ├── max-per-action-cap.mjs
│       ├── cooldown-window.mjs
│       ├── burn-rate-oracle.mjs
│       └── yield-curve-preservation.mjs
│
├── apps/
│   ├── dashboard/
│   └── landing/
│
├── packages/
│   └── shared-schemas/
│
└── scripts/
    ├── demo-setup.mjs
    ├── verify-docs.mjs
    └── seed-testnet.mjs
```

### 22.2 Dashboard route map *[LOCKED]*

| URL | Page | Data source | Components |
|---|---|---|---|
| `/` | redirect → `/overview` | — | — |
| `/overview` | Overview screen | `GET /api/state` (every 5s) | `StatsCard` ×3, `RunwayChart`, `LedgerTable` |
| `/fleet` | Fleet list | `GET /api/fleet` | `WalletRow` ×N, "add via CLI" CTA |
| `/fleet/[id]` | Single wallet detail | `GET /api/fleet/:id` | `StatsCard`, history sparkline, recent top-ups |
| `/treasury` | Treasury sources | `GET /api/treasury` | Table of sources, APY, balance |
| `/actions` | Full ledger | `GET /api/actions?limit=100&before=...` | `LedgerTable` paginated |
| `/actions/[id]` | Action detail | `GET /api/actions/:id` | Action timeline, all tx hashes with `TxLink`, all policy evaluations |
| `/policies` | Policy overview | `GET /api/policies` | `PolicyCard` ×8 (5 ours + 3 upstream) |
| `/policies/[name]` | Single policy | `GET /api/policies/:name` | Config + last 100 evaluations table |
| `/settings` | Read-only config view | `GET /api/settings` | Form (read-only), CLI hint to edit |

### 22.3 Daemon HTTP API *[LOCKED]*

| Path | Method | Returns |
|---|---|---|
| `/api/health` | GET | `{ status: 'ok', daemonPid, startedAt, version }` |
| `/api/state` | GET | aggregate dashboard state (one round-trip for overview) |
| `/api/state/stream` | GET (SSE) | live event stream |
| `/api/fleet` | GET | `SubordinateWallet[]` + per-wallet derived runway |
| `/api/fleet/:id` | GET | single wallet + recent samples |
| `/api/treasury` | GET | `TreasurySource[]` + APY snapshots |
| `/api/actions` | GET | paginated ledger of TopUpAction |
| `/api/actions/:id` | GET | single action with full event timeline |
| `/api/policies` | GET | policy registry + per-policy stats |
| `/api/policies/:name` | GET | single policy config + evaluation history |
| `/api/settings` | GET | runtime config (read-only) |

No POST/PUT/DELETE routes. Mutations go through CLI only.

---

## Section 23 — Environment & Secrets *[LOCKED]*

### 23.1 Required env vars

| Var | Purpose | Where used |
|---|---|---|
| `ZERION_API_KEY` | Read access to Zerion API (or use `--x402`) | CLI + daemon |
| `WALLET_PRIVATE_KEY` | Required if using `--x402`. The QM wallet key | CLI x402 mode |
| `ZERION_AGENT_TOKEN` | Auto-populated by `zerion wallet create --agent` | CLI trading, daemon |
| `QM_TICK_SECONDS` | Watcher tick interval | Daemon |
| `QM_BRIDGE_TIMEOUT_SEC` | Max bridge wait | Daemon |
| `QM_SWAP_TIMEOUT_SEC` | Max swap wait | Daemon |
| `QM_DASHBOARD_PORT` | Local HTTP port | Daemon, dashboard |
| `QM_ENV` | `mainnet` \| `testnet` | All |
| `QM_LOG_LEVEL` | `debug | info | warn | error` | Daemon |

### 23.2 Secret hygiene

- `.env` gitignored
- `.env.example` shows fake values
- README warns: never paste private keys into Claude Code context
- QM wallet is FRESH — never the principal's main wallet
- Agent token in `~/.zerion/config.json` (upstream)
- Echo upstream reviewer's open finding on `agentToken` redaction in our README — recommend users avoid `zerion config list` in shared screens

---

## Section 24 — Past-Build Lessons Applied *[LOCKED]*

Each row maps a past Tim build to a concrete v2 application.

| Build | Lesson | v2 application |
|---|---|---|
| **NeuroDegen** | Pivoted color theme late. Lock palette early. | §16.1 — Specie palette locked; explicitly chosen to avoid prior NeuroDegen amber, Remlo palette, LocalRx navy/green |
| **NeuroDegen** | One distinctive technical commitment as moat (commit-reveal attestation). | §3.4 — Quartermaster's moat = the policy framework as a forkable artifact. README leads with `cli/policies/README.md` |
| **Remlo SWARM** | Single J1 demo centerpiece judges remember (agent-as-employee). | §3.5 — J1 = live policy refusal at 1:30 mark of demo. Every other beat serves it |
| **Remlo SWARM** | Hard feature freeze + repo freeze dates. | §32 — explicit freeze dates once Tim provides submission deadline |
| **LocalRx** | Stress-test 6+ concepts before picking 1; criteria-driven. | Done — 12 concepts (Grok 7 + Gemini 5) tournamented against rubric. §1.2 winners autopsy noted |
| **Anthropic ideation** | Reason from rubric/competitive landscape, not personal expertise. | §3.6 — adversary model explicit; rubric weights drove §1 recon |
| **DarkOdds** | Lead copy with concrete capability + chain + selective-disclosure, not vibes. "Live on Arb Sepolia" + "permissionless" + "selective-disclosure." | §17.4 — landing lead: "Live on Base. Five composable policies. Signs only what they permit." |
| **Citrea Ship 1** | Find embarrassing-but-shipping pattern in ecosystem; fix it. (Citrea's own docs showed plaintext keys; we shipped secure key management.) | §1.4 — zerion-cli ships 3 minimal policies; we ship 5 that compose. The ecosystem ships scaffold; we ship the framework |
| **Citrea Ship 2 pivot** | Be willing to pivot if upstream changes. (Their llms.txt killed our docs-MCP plan.) | §0.2 — DEVIATIONS.md mandatory; pivots are the protocol output, not failures |
| **Tessera** | Day 0 devnet validation (relayer + indexer live check) before Claude Code prompts begin. | §27 — Day 0 Gate as concrete checklist |

---

## Section 25 — Testing Strategy *[LOCKED]*

(Per Rule B7 — tests as long as the contract.)

### 25.1 Test layers

| Layer | Tool | Coverage target |
|---|---|---|
| Policy unit tests | `node:test` | Each policy: 4+ cases — happy path, boundary at threshold, just-below-threshold, explicit reject. 100% branch coverage of policy file |
| Decider unit tests | `node:test` | Given fleet+treasury+samples fixtures, assert target/source/amount selection. ≥10 fixtures across normal, tied, no-source, anomalous |
| Watcher unit tests | `node:test` | Given mocked Zerion responses, assert correct sample emission and ledger event sequence |
| Reconcile unit tests | `node:test` | Each error state from §6.3, assert recovery action |
| Ledger contract tests | `node:test` | Every event type from §7 round-trips through write→read |
| HTTP API tests | `node:test` + `fetch` | Each route in §22.3 returns correct shape against zod schema |
| CLI smoke tests | shell + `node:test` | Each new command parses correctly, calls correct lib function |
| End-to-end Base Sepolia | Manual + scripted | One full happy-path top-up cycle on testnet, tx hashes captured for README |

### 25.2 Specific test patterns required

**Per policy file, these tests MUST exist:**
1. `evaluate(known-good-context) → ok: true`
2. `evaluate(threshold-context) → ok: true` (exactly at the boundary)
3. `evaluate(just-over-threshold) → ok: false, reasonCode: '<EXPECTED_CODE>'`
4. `evaluate(extreme-anomalous-context) → ok: false`
5. `evaluate(missing-required-field) → throws or ok: false with reason MALFORMED_CONTEXT`

**For burn-rate-oracle specifically:**
- EWMA correctness: feed sequence of spends, assert math matches expected
- Spike detection: feed baseline 1 USDC/h × 7d, then 11 USDC/h × 1h → reject
- Sustained-need: zero burn → reject NO_SUSTAINED_BURN

**For yield-curve-preservation:**
- Source priority by APY ascending
- Tie-break by `priority` ascending
- Insufficient balance → not selected
- Below `minRetainedBalance` → not selected

### 25.3 No-mock policy

Tests use real fixtures, never mock the policy logic itself. We mock Zerion API at the network boundary (using fixed JSON files in `tests/fixtures/zerion/`), but the policy code under test runs unmocked.

End-to-end Base Sepolia is REAL. No simulation. No demo data. (Memory rule: no demos.)

### 25.4 Test commands

```
pnpm test              # all unit tests
pnpm test:cli          # CLI smoke
pnpm test:e2e          # requires ZERION_API_KEY + funded sepolia wallet
```

CI: GitHub Actions runs unit + cli on every push. e2e is manual (requires private state).

---

## Section 26 — Demo Script *[LOCKED]*

### 26.1 Three-pane setup (per Rule C10)

```
┌──────────────────┬──────────────────┬──────────────────┐
│ Terminal         │ Dashboard        │ Basescan         │
│ (daemon logs)    │ (live state)     │ (tx confirmations)│
│                  │                  │                  │
│ qm tick logs     │ runway chart     │ each tx pinned   │
│ policy events    │ ledger tail      │ via TxLink click │
└──────────────────┴──────────────────┴──────────────────┘
```

Use a 16:9 1920×1080 recording. Each pane ~33% width. Terminal in JetBrains Mono 13px, dashboard at 100% zoom, Basescan in a side browser pinned to the QM wallet's address page filtered to last 24h.

### 26.2 Pre-recording setup

1. Fresh `~/.zerion/` (archive any existing)
2. **Production-grade Base Sepolia setup** — no mocks (memory rule). Faucet-funded principal wallet. Three subordinate wallets pre-funded with ~$2 USDC each.
3. Real x402-using subordinates: each runs `zerion wallet analyze vitalik.eth --x402` every 30s in a tight loop, real tx
4. Tight policy thresholds for demo speed:
   - MIN_RUNWAY = 10 minutes
   - COOLDOWN = 60 seconds
   - MAX_PER_ACTION = $5
5. Start the daemon AT recording time so judges see a clean "starting" log
6. Have a recorded backup video in case live runs flake

### 26.3 The 3-minute screenplay

**0:00–0:20 — hook**
Show terminal. "These are three agents calling Zerion via x402. Each call costs $0.01 USDC. They drain. In production, they'd go silent." Subordinate balances ticking down visibly.

**0:20–0:50 — architecture**
Cut to architecture diagram. "Quartermaster is a fourth agent whose only job is to keep the first three alive. Watches their balances. Projects runway. Tops them up from your yield positions. Gated by five composable policies."

**0:50–1:30 — live action**
Three-pane. Subordinate's runway drops below 10min. Watcher fires (terminal scrolls). Decider picks lowest-yield source. Policy engine validates (5 green checks scroll past). Executor runs swap → bridge → send. Click swap tx hash → Basescan opens → confirmed. Click bridge → confirmed. Click send → confirmed. Dashboard shows action in ledger. Subordinate balance ticks up. Tim: "Ten seconds. Solvent. No human in the loop."

**1:30–2:00 — J1: policy refusal**
Tim runs `zerion qm test spike --wallet=alpha --rate=1000`. Daemon detects burn rate jumped from baseline 0.5/h to 1000/h (2000x). burn-rate-oracle fires. Dashboard shows blocked action with `BURN_RATE_ANOMALY_DETECTED`. Tim: "It refused itself. The agent looked at the math and said: this isn't real demand, this looks like manipulation. No god-mode."

**2:00–2:40 — framework depth**
Quick scroll through `cli/policies/`. "Each policy is a single file. Forty lines on average. Drop a new one in this directory and it composes with the rest. The framework is the product."

**2:40–3:00 — close**
"x402 is now Linux Foundation infrastructure as of April 2026. The agent economy is live. Someone has to keep it solvent. GitHub link in the description."

### 26.4 E2E tx hash list for README

The README ships a curated table of testnet tx hashes covering every state transition. Reviewers click and verify on Basescan.

| Event | tx hash | Basescan |
|---|---|---|
| Treasury swap (USDC → bridge token) | `0x...` | link |
| Cross-chain bridge | `0x...` | link |
| Final send to subordinate | `0x...` | link |
| Subordinate x402 tx (the burn) | `0x...` | link |
| Blocked action (no on-chain tx by definition; ledger event hash logged) | sha256(canonical JSON) | — |

Day 0+ task: every testnet run captures hashes; final pre-submission run produces the canonical hash set.

### 26.5 Demo hygiene

- Base Sepolia (fast finality) — NEVER demo on mainnet under time pressure
- Pre-warm Zerion API cache 5min before recording
- Backup recorded video ready
- Keep terminal at 13px so logs are legible at 1080p

---

## Section 27 — Day 0 Gate *[LOCKED]*

(Per Phase E — gate before any code. From Tessera lesson.)

### 27.1 Day 0 must-pass checklist

Tim (or Claude Code) verifies each before Phase 1 begins. Each item is yes/no. Any "no" blocks code start until resolved.

**Documentation verification (per §0.2):**
- [ ] zerion-ai PR #5 fetched and snapshot in `docs-verified/zerion-cli.md`
- [ ] zerion-ai PR #5 head commit pinned in `package.json` of fork
- [ ] developers.zerion.io/llms.txt fetched and snapshot in `docs-verified/zerion-api.md`
- [ ] github.com/coinbase/x402 README + spec snapshot in `docs-verified/x402.md`
- [ ] @open-wallet-standard/core latest version snapshot
- [ ] viem version pinned and snapshot
- [ ] Next.js 15 docs snapshot of app router conventions

**Infrastructure liveness:**
- [ ] Base mainnet RPC responds (chainId 8453)
- [ ] Base Sepolia RPC responds (chainId 84532)
- [ ] Basescan returns tx for a known mainnet hash
- [ ] Sepolia Basescan returns tx for a known testnet hash
- [ ] Zerion API key `zk_dev_...` returned valid response from `/portfolios/<vitalik>`
- [ ] `npx zerion-cli wallet analyze 0xd8dA...` succeeds (smoke the CLI is real)
- [ ] x402 facilitator endpoint reachable (test with the public Coinbase facilitator URL)
- [ ] **CRITICAL** — verify x402 supports Base Sepolia. If facilitator is mainnet-only, demo plan changes: subordinates burn USDC mainnet (small amounts) OR we mock x402 burns with deliberately-spent test USDC and document it as such

**Wallet & token plumbing:**
- [ ] `zerion wallet create` produces an encrypted keystore in `~/.zerion/keystore/`
- [ ] `zerion wallet create --agent` produces a wallet AND an agent token saved to config
- [ ] OWS signs a no-op test transaction on Base Sepolia
- [ ] Existing policies (`allowlist`, `deny-approvals`, `deny-transfers`) reject and pass correctly with the issued agent token

**Cost analysis:**
- [ ] Estimated total testnet ETH burn for 2 weeks of dev + demo prep: < 0.5 Sepolia ETH
- [ ] Estimated total Sepolia USDC needed for fleet + treasury fixture: < 50 USDC
- [ ] If x402 doesn't support testnet, mainnet USDC budget for demo: < 5 USDC

### 27.2 Day 0 deliverables

Writeups committed to repo:
- `docs-verified/` (all snapshots)
- `docs-verified/DEVIATIONS.md` (anything in this PRD that disagrees with reality)
- `AGENT_PROGRESS.md` Phase 0 entry (per §28)
- `scripts/seed-testnet.mjs` script that funds three subordinate wallets from a seed wallet on Base Sepolia
- README skeleton (just the title, hero, and link placeholders)

### 27.3 Day 0 takes how long

Estimated 4-8 hours. If it takes longer than that, the project is under-scoped or upstream is unstable. Do NOT proceed to Phase 1 with unresolved Day 0 items. Better to surface the gap to Tim than build on quicksand.

---

## Section 28 — AGENT_PROGRESS.md Specification *[LOCKED]*

(Per Rule B6 — captures version gotchas between sessions.)

### 28.1 Purpose

Claude Code sessions are not infinite. Context resets. AGENT_PROGRESS.md is the handoff document between sessions — a returning agent reads it before doing anything.

### 28.2 Structure

Append-only. New entry per session. Newest at top.

```markdown
## Session 2026-04-30 / Phase 1 / claude-code-opus-4.7

### Completed
- Forked zerion-ai at commit `<sha>`
- Established monorepo layout per PRD §22.1
- Verified all upstream tests pass (npm test → 139 pass)

### Files touched
- package.json (created root)
- pnpm-workspace.yaml (created)
- cli/ (initial fork copy)

### Tests run
- `pnpm test` — all pass
- Verified `npx zerion-cli wallet analyze vitalik.eth` works end-to-end

### Open questions for Tim
- (none for this phase)

### Deviations from PRD
- See `docs-verified/DEVIATIONS.md` line 12: upstream renamed `cli/zerion-cli.js` to `cli/zerion.js` per commit `3041f21` — PRD references corrected

### Next phase entry conditions
- Phase 2 begins with `cli/lib/fleet/registry.js` creation
- Pre-req: confirm zod schemas land in `packages/shared-schemas/` first

### Context window state at handoff
- Approximate tokens used: 45K / 200K budget for this phase
- Key files agent should re-read at start of next session: PRD §6, §7, §9.3
```

### 28.3 Mandatory triggers for an entry

- End of every phase (§31)
- Any time the agent finds itself approaching a context window limit
- After any DEVIATIONS.md entry
- When Tim manually says "checkpoint"

### 28.4 Reading protocol

At the start of every Claude Code session, the agent reads:
1. `AGENT_PROGRESS.md` (latest entry, plus latest entry of any phase the current task touches)
2. `docs-verified/DEVIATIONS.md` (full)
3. The PRD section for the current phase

Only then does it begin work.

---

## Section 29 — Distribution Plan *[LOCKED — POST-SUBMISSION ONLY]*

(Per Phase H. Memory rule: incorporation/distribution deferred until post-submission. Do not spend build hours on distribution.)

### 29.1 Submission day (T+0)

- README polished, demo video embedded
- GitHub repo public, MIT license, clear "fork this" CTA in first 200 words
- Landing page deployed to Vercel with custom domain
- Tweet thread drafted but NOT posted (post post-submission to avoid review noise)

### 29.2 T+24 hours (after submission window closes)

- Post tweet thread (5-7 tweets) leading with the 30-second pitch from §3.2 + demo video
- Post on Farcaster (warpcast)
- Soft DM to Zerion's `@zerion_io` and dev contacts — gift-first, no role ask, "thought you'd want to see this fork pattern" (Citrea Ship 1 lesson)
- Submit to "Awesome Agents" lists, etc.

### 29.3 T+1 week

- If we placed: write up the win as a public retro
- If we didn't: write up "what we learned" anyway — feeds Phase I post-mortem
- Post longer-form blog: "The treasury layer for the agent economy"

### 29.4 What we do NOT do during build

- Twitter posting
- Cold outreach
- Ecosystem manager DMs (Jason Chew style — only when product is shipped, never during build)
- Discord ecosystem campaigning

---

## Section 30 — Grok Verification Hooks (Build Phase) *[LOCKED]*

Memory rule: for every claim block, write a Grok prompt first, Tim runs it, return output, revise.

During build phase, this applies less to ideation and more to **assumption-checking**. Specifically:

### 30.1 When to write a Grok prompt during build

- Before locking the math for any quantitative policy (§8.3 burn-rate threshold, §8.4 yield ordering)
- Before adopting a non-trivial third-party library (e.g., chosen logging library, chart library)
- Before publishing the demo video — Grok-prompt to scrutinize the demo claims for technically misleading framings
- Before the post-submission tweet thread — Grok-prompt to find weakest claims

### 30.2 Format

The agent writes a Grok prompt to `grok-prompts/YYYY-MM-DD-<topic>.md` with header noting what claim is being verified. Tim runs Grok, pastes output back. Agent updates claim or escalates.

Note: this is a soft protocol during build (not every line of code). Mandatory only at the gates listed above. Don't slow down velocity.

---

## Section 31 — Build Phases *[LOCKED]*

(Mapped to canonical Phase 0→6 per Rule C11.)

### 31.1 Phase 0 — Foundation (Day 0 gate)

Per §27. Doc verification + infra liveness + wallet plumbing. Output: `docs-verified/`, `DEVIATIONS.md`, `AGENT_PROGRESS.md` Phase 0, README skeleton, seed scripts.

**Daily artifact:** the Day 0 gate checklist with each box ticked.

**Phase exit criteria:** all §27.1 boxes ticked; Tim confirms.

### 31.2 Phase 1 — Fork & monorepo (canonical "contracts" — for us, the upstream CLI is our contract surface)

- Fork zerion-ai at pinned commit
- Establish `pnpm-workspace.yaml`, `package.json` root, `tsconfig.base.json`
- Verify upstream tests pass unchanged
- Add monorepo apps/ and packages/ skeletons (empty)

**Daily artifact:** repo on GitHub, CI green on upstream tests.

**Exit:** `pnpm test` passes; tree matches §22.1.

### 31.3 Phase 2 — Registries & shared schemas (canonical "SDK")

- `packages/shared-schemas/` zod definitions for SubordinateWallet, TreasurySource, BurnRateSample, TopUpAction, LedgerEvent
- `cli/lib/fleet/registry.js`
- `cli/lib/treasury/sources.js`
- New CLI commands: `zerion fleet add/list/remove/status`, `zerion treasury add/list`
- Unit tests for registry CRUD

**Daily artifact:** `zerion fleet add demo-1 0x...` works, writes to `~/.zerion/quartermaster/fleet.json`.

**Exit:** registries working, tests pass.

### 31.4 Phase 3 — Policies (canonical "services" tier 1)

- `cli/policies/max-per-action-cap.mjs`
- `cli/policies/cooldown-window.mjs`
- `cli/policies/burn-rate-oracle.mjs`
- `cli/policies/yield-curve-preservation.mjs`
- Register all four in `cli/policies/run-policies.mjs`
- Unit tests per §25.2

**Daily artifact:** `node tests/policies.test.mjs` runs green.

**Exit:** all policy tests pass; manual `zerion qm policy get burn-rate-oracle` works.

### 31.5 Phase 4 — Watcher + Decider + Executor + Ledger (canonical "agent")

- `cli/lib/qm/watcher.js`
- `cli/lib/qm/decider.js`
- `cli/lib/qm/executor.js` (subprocess wrapper around `zerion swap/bridge/send`)
- `cli/lib/qm/ledger.js`
- `cli/lib/qm/reconcile.js`
- `cli/lib/qm/apy.js`
- `cli/lib/qm/ewma.js`
- `cli/lib/qm/http-server.js` (basic — `/api/health`, `/api/state` only)
- New CLI commands: `zerion qm run/pause/resume/plan/policy set/policy get/reconcile/tune`
- Integration test: full happy path using a mocked-network fixture
- Live e2e on Base Sepolia: one full top-up (capture tx hashes for §26.4)

**Daily artifact:** `zerion qm run` daemon starts, tickbeat visible in logs, test top-up succeeds on Sepolia.

**Exit:** Base Sepolia happy-path top-up confirmed via Basescan; tx hashes captured.

### 31.6 Phase 5 — Dashboard (canonical "frontend")

- `apps/dashboard/` Next.js 15 + Tailwind 4 + shadcn
- Routes per §22.2 — start with `/overview`, then `/actions`, then rest
- `daemon-client.ts` HTTP client
- Components per §20
- Live update via SSE
- Theme tokens per §16

**Daily artifact:** Overview screen renders against running daemon.

**Exit:** All routes implemented, Specie palette applied, contrast verified, live polling works during a test top-up.

### 31.7 Phase 6 — Landing + Submission

- `apps/landing/` Next.js — single page per §17.2
- Deploy to Vercel
- Record demo video per §26
- Polish README: hero, install (3 commands), policy framework primer (link to `cli/policies/README.md`), full E2E tx hash table per §26.4
- Final test pass on Base Sepolia
- Submission

**Daily artifact:** landing live, video recorded, README ships with curated tx hashes.

**Exit:** submission posted with all artifacts.

### 31.8 Daily hero check (per Phase F)

Every build day, the agent surfaces ONE artifact to Tim — a screenshot, a tx hash, a passing test, a working CLI command. If a day passes without an artifact, the daemon (Tim's playbook daemon, not the product) raises a flag.

---

## Section 32 — Code Freeze & Submission Timeline *[DEFAULT — Tim provides exact dates]*

Once Tim provides the Colosseum submission deadline, fill these in:

- **Hackathon end (T):** TBD by Tim
- **Code freeze (T - 72h):** No new features. Bug fixes only. Test pass + demo prep.
- **Asset freeze (T - 48h):** Demo video recorded. README final. Landing page final.
- **Repo freeze (T - 24h):** Final tag, no commits. Anything broken at this point becomes a known-issue note in submission, not a code change.
- **Submission (T - 6h):** Submit. Buffer for inevitable platform issues.

(Remlo SWARM lesson: hard freezes prevent last-minute breakage.)

---

## Section 33 — Post-Mortem Framework *[ADVISORY]*

(Per Phase I — feeds next hackathon.)

After submission, regardless of outcome, write:

```
post-mortem/quartermaster.md

## Outcome
- Placed: yes/no/which place
- Prize: USD amount or 0

## What worked
- (3-5 bullets, with evidence)

## What didn't
- (3-5 bullets, with evidence)

## Surprises
- (2-3 bullets)

## Reusable artifacts for next build
- (specific files, patterns, tools to keep)

## Specific lessons to add to operational rules
- (1-3 candidate rule additions for memory)

## What I'd do differently with another 2 weeks
- (2-3 bullets)
```

This file is the input to the NEXT hackathon's Phase A recon (winners autopsy).

---

## Section 34 — Risks & Mitigations *[LOCKED]*

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| PR #5 merges with breaking changes mid-build | Medium | High | Pinned commit; §0.2 catches drift; rebase budget allocated in Phase 4 |
| x402 doesn't support Base Sepolia | Medium | Medium | Day 0 catches; fallback is small mainnet USDC for demo |
| Zerion API rate limit (120/min dev key) hits during watcher | Low | Medium | Tick at 60s for fleet of 5 = ~5 calls/min; back off on 429; mainnet API key budget noted |
| Base Sepolia RPC flakes during demo | Medium | High | Backup recorded video; multiple RPC providers configured |
| Bridge tx hangs mid-demo | Low | High | Demo uses Base-only treasury source (USDC, sDAI on Base) — no bridge in demo path; bridge is shown as architectural capability not demo step |
| OWS signing API changes in point release | Low | High | Pin OWS version; §0.2 catches |
| Judges miss x402 framing | Low | High | Landing leads with it; demo opens with it; README leads with it |
| Over-scope ships 60% broken | Medium | Catastrophic | Phase-gated build; each phase has a Tim checkpoint; no skipping |
| Policy bug permits god-mode in edge case | Low | Catastrophic | Per-policy unit tests with boundary cases; upstream `deny-transfers` as cap-of-caps |
| Daemon HTTP server exposes data to other localhost processes | Low | Medium | Bind 127.0.0.1 only; document in README; future work: localhost auth token |
| Tim runs out of context window during build | Medium | Medium | AGENT_PROGRESS.md handoffs; phase boundaries are natural breaks |
| Demo video file too large for submission | Low | Low | Compress; host on Vimeo or YouTube unlisted, embed |

---

## Section 35 — Submission Artifacts *[LOCKED]*

Required by track:
- [ ] Forked public GitHub repo from `zeriontech/zerion-ai`
- [ ] At least one scoped policy (we ship 5 new + 3 inherited)
- [ ] At least one real onchain tx (we ship full multi-tx flow per top-up)
- [ ] All swaps route through Zerion API (enforced — every swap is `zerion trading swap`)
- [ ] Demo video OR live demo (both)
- [ ] Open-source license (MIT, matches upstream)

Submission strength additions:
- [ ] README with architecture diagram, install, policy primer, E2E tx hash table
- [ ] Landing page on Vercel with embedded demo video
- [ ] AGENT_PROGRESS.md showing build provenance
- [ ] DEVIATIONS.md showing rigor of doc verification
- [ ] Twitter/X thread drafted (post post-submission)

---

## Appendix A — Glossary

- **Agent token** — narrow-scope signing credential issued by OWS. Revocable. Policy-bound.
- **Burn rate** — USDC spent per unit time by a subordinate, derived from recent tx history.
- **CAIP-2** — chain identifier standard, e.g., `eip155:8453` is Base.
- **EIP-3009** — token transfer authorization standard used by x402 for USDC.
- **EWMA** — exponentially weighted moving average; how we smooth burn rate.
- **Fiduciary** — one who acts in the best interest of another. Quartermaster is a programmatic fiduciary for fleet solvency.
- **Fleet** — set of subordinate agent wallets Quartermaster is responsible for.
- **J1** — the singular demo moment that earns the win.
- **OWS** — Open Wallet Standard. Signing engine inside zerion-cli.
- **Runway** — time remaining until a wallet's balance hits zero at current burn rate.
- **x402** — HTTP 402 Payment Required, now an open protocol for pay-per-call agent payments.

## Appendix B — Why "Quartermaster"?

In every military organization older than a century, the quartermaster keeps the fighting force supplied — food, ammunition, medical, transport. Doesn't fight. Doesn't strategize. Makes sure nobody runs out of anything essential.

That's this product, exactly.

The product is named Quartermaster to communicate one idea: **this agent serves other agents and has no ambitions beyond that.** It's plumbing for the machine economy, and plumbing is honest work.

## Appendix C — Document v2 changelog vs v1

- Added Recon Dossier (§1) — Phase A
- Added Defensibility & Adversary Model (§3) — Phase B/C
- Added Past-Build Lessons Applied (§24) — explicit learning surface
- Added Day 0 Gate (§27) — Phase E
- Added AGENT_PROGRESS.md spec (§28) — Rule B6
- Added Distribution Plan (§29) — Phase H, post-submission only
- Added Grok Verification Hooks build-phase (§30)
- Added Code Freeze & Timeline (§32) — Phase G
- Added Post-Mortem Framework (§33) — Phase I
- Rewrote Security as layer/mechanism/enforcement table (§14) — Rule C9
- Rewrote Testing Strategy as LOCKED with specific patterns (§25) — Rule B7
- Rewrote Demo Script with three-pane terminal+dashboard+Basescan + tx hash list (§26) — Rule C10
- Rewrote Build Phases mapped to canonical Phase 0→6 (§31) — Rule C11
- Added formal Route Map (§22.2) — Rule B5
- Added Component Library Inventory (§20) — Rule B5
- Added Pinned Versions Table (§21.2) — Rule B5
- Added Daemon HTTP API spec (§22.3)
- Added Structured Event Spec (§7 LedgerEvent + §15) — Rule C8
- Added Contrast Verification (§16.2) — Day 0 task
- Added Idempotency Detail (§6.4) — fix v1 hand-waviness
- Added Re-entrancy rules (§6.5) — fix v1 gap
- Added Burn-Rate Math (§8.3) — fix v1 vagueness
- Added Tradeoffs Accepted subsection (§5.3) — explicit reasoning

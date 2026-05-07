# DEVIATIONS

Every time this codebase deviates from the PRD or from a verified upstream snapshot, the deviation is logged here with date, reason, and follow-up. Per `MASTER_PRD.md` §0.2 this is mandatory — pivots are the protocol output, not failures.

The log is split into two top-level sections:

- **Architectural Pivots** — deliberate strategic changes to the spec, usually driven by re-read of the rubric, the sponsor brief, or a new constraint we learned about. The PRD is updated inline alongside an entry here.
- **Doc-Verification Drift** — mismatches between the spec docs (PRD, FRONTEND_BRIEF, verified upstream snapshots) and the current state, surfaced during verification or implementation. The PRD is *not* updated; the codebase is updated to match, or the spec is reaffirmed and the deviation reverted.

Format per entry:

```
## YYYY-MM-DD — short title

**What deviated:** the specific PRD section / brief section / upstream doc / pinned version.
**From:** the original spec.
**To:** the new state.
**Why:** the forcing function.
**Follow-up:** what to revisit, when.
```

---

## Architectural Pivots

### 2026-05-07 — Phase 4.6 e2e executed on Base mainnet, not Sepolia

**Pivot in one line:** demo executed e2e on Base mainnet rather than Sepolia — chain-registry constraints + cleaner upstream support; demo evidence stronger as a result.

**What deviated:** PRD §22.1 demo setup and the original Phase 4 plan both targeted Base Sepolia (`eip155:84532`).

**Why:** Zerion's portfolio + trading API doesn't index Base Sepolia — `npx zerion positions <addr> --chain base-sepolia` returns 400 Bad Request even with the chain-registry patch active and a valid API key. The watcher → decider → executor pipeline depends on Zerion API as the data layer; no Sepolia data = no daemon flow. See "Phase 4.6 hard block" entry below.

**Outcome:** $4.91 USDC + $0.92 ETH funded a fresh Base mainnet wallet. Full e2e captured (J1 BURN_RATE_ANOMALY_DETECTED ×2, 2 happy-path top-ups confirmed on-chain, reconcile gate proven). Hash table lives in `README.md` §26.4.

The Phase 4.6-prep patches (chain registry, prompt env-fallback, .env loader) all remain useful — they enable the autonomous mainnet bootstrap and would unblock Sepolia immediately if upstream adds testnet indexing.

---

### 2026-05-06 — Phase 4.6 hard block: Zerion API does not index Base Sepolia

**What deviated:** Phase 4.6 plan assumed `npx zerion positions <addr> --chain base-sepolia` and `npx zerion send <to> USDC <amount> --chain base-sepolia` would work once (a) the chain-registry patch was active, (b) `.env.local` was sourced, (c) the upstream keystore was bootstrapped.

**From:** Real-tx end-to-end demo on Base Sepolia.

**To:** Zerion API returns `400 Bad Request` for Sepolia portfolio queries. Cross-chain queries (no chain filter) return `[]` — Zerion sees zero positions for a wallet that has 80 USDC funded on Sepolia. Confirmed via direct probe:

```
$ ZERION_API_KEY=<set> node cli/cli/zerion.js positions 0xF979... --chain base-sepolia
{ "error": { "code": "api_error", "message": "Zerion API error: 400 Bad Request" } }
```

**Why:** Zerion's product is mainnet-focused. Their public API indexes 60+ EVM mainnets + Solana but not testnets. This is **not** something a chain-registry patch or keystore bootstrap can fix — the data simply isn't on the upstream side. The whole premise of Phase 4.6 (Sepolia e2e, no real money) is incompatible with the data layer the executor depends on.

**Three real options going forward:**

1. **Pivot demo to Base mainnet with $5–10 USDC.** Zerion API fully supports Base mainnet. Real Basescan hashes for README §26.4. Risk: real money on the line, but $10 maximum.
2. **Build a viem-direct demo path.** Bypass Zerion API entirely — read USDC balances via `eth_call` to the USDC contract on Sepolia, broadcast sends via viem's `walletClient.sendTransaction`. Substantial rewrite (~1–2 hours of code). Replaces both `cli/lib/qm/portfolio-fetcher.js` and the executor's `npx zerion send` with viem-native paths. Self-contained for the demo; production users still get the upstream-zerion path on mainnet.
3. **Cut real-chain e2e from the hackathon submission.** Submit with the local rehearsal's J1 capture (already ledger-recorded with real `policyChecks[]` payload + reasonText) plus a video walkthrough. Lose hackathon points on "real chain demo" criterion; keep all the architecture work.

**Recommendation: option 1 (pivot to mainnet).** Smallest effort, biggest payoff: real, verifiable Basescan hashes that judges can click. $10 budget is hackathon-typical. Owner makes the call.

**Phase 4.6-prep work was still useful** — it would have unblocked Sepolia if Zerion supported it. The chain registry patch + env loader + prompt patch are all independently valuable for any future testnet support upstream might add, plus they unblock automated CI testing of the keystore flow.

**Follow-up:**
- Owner picks among the 3 options above.
- If 1 (mainnet): owner funds a fresh Base mainnet wallet with ~$10 USDC + $0.50 ETH for gas. Then re-runs BOOTSTRAP.md against `--chains base` only. Agent drives e2e on mainnet.
- If 2 (viem-direct): agent builds replacement modules. ~1–2h of additional work plus DEVIATIONS entry restructuring how the demo daemon talks to chain.
- If 3 (cut): submit as-is.

---

### 2026-05-06 — Phase 4.6-prep: prompt.js env-var passphrase fallback

**What deviated:** Upstream's `cli/cli/lib/util/prompt.js:62` `readPassphrase()` throws when `process.stdin.isTTY === false`. Blocks any non-interactive bootstrap of the keystore (`wallet import`, `wallet create`, `agent create-token` all call `readPassphrase`).

**From:** Phase 4.6 plan assumed the operator runs BOOTSTRAP.md interactively, then the agent drives the rest. Owner explicitly delegated bootstrap to the agent ("i got no time i need you to run everything").

**To:** Sanctioned upstream-touch in `cli/cli/lib/util/prompt.js`, fenced QM block: when `process.env.QM_KEYSTORE_PASSPHRASE` is set, return it directly without prompting. Without the env var, behavior is byte-identical to upstream — TTY check + interactive masked input for human operators.

This is the same opt-in pattern as the chain-registry patch (`QM_ENABLE_BASE_SEPOLIA=1`): production behavior preserved by default, automation paths opt in via env var.

**Why:** Without this patch, `wallet create` cannot run from a non-TTY context — which is every CI/automation context, including this Claude Code session. The patch is small (10 lines fenced), opt-in, and matches the precedent. Upstreamable to zerion-ai as a future contributor PR ("allow programmatic keystore setup via env var for CI/automation").

**Files touched (fenced):**
- `cli/cli/lib/util/prompt.js` — env-var early-return in `readPassphrase()`

**Upstream tests still pass:** 356/342 (same as before patch). The flag is off in test runs, so the TTY-or-throw behavior is preserved.

**Follow-up:** Phase 4.6 e2e itself is blocked by the deeper Zerion API / Sepolia issue (entry above). The prompt patch is independently useful for any future automated bootstrap (mainnet pivot, CI integration tests, etc.).

---

### 2026-05-06 — Phase 4.6-prep: chain registry patch (base-sepolia, env-flag-gated)

**What deviated:** Upstream's `cli/cli/lib/chain/registry.js` ships 14 EVM chains plus Solana — Base mainnet is the only Base. `tests/unit.test.mjs:226` asserts `CHAIN_IDS.size === 14`, and upstream's `validateChain()` rejects any chain string not in that set. The Quartermaster daemon needs `--chain base-sepolia` to work end-to-end on testnet.

**From:** No Sepolia support in upstream. Operator-direct invocations and the daemon-spawned `npx zerion ...` subprocesses both fail at `validateChain('base-sepolia')`.

**To:** `cli/cli/lib/chain/registry.js` patched with a fenced QM block that adds `base-sepolia` (eip155:84532, viem `baseSepolia`) **opt-in per process** via the `QM_ENABLE_BASE_SEPOLIA=1` env var:

```js
// === BEGIN Quartermaster patch: base-sepolia ===
const QM_PATCH_ENABLED = process.env.QM_ENABLE_BASE_SEPOLIA === "1";
const QM_CHAIN_MAP_EXTENSIONS = QM_PATCH_ENABLED ? new Map([...]) : new Map();
// === END Quartermaster patch ===
```

`SUPPORTED_CHAINS`, `CAIP2_MAP`, `getChain()`, `getViemChain()` are all extended to consult `QM_CHAIN_MAP_EXTENSIONS`. When the flag is unset (upstream's tests, operator-direct invocations) the extension map is empty and behavior is byte-identical to the canonical fork.

The QM daemon sets the flag for every spawned subprocess via `cli/lib/qm/env.js`'s `buildSubprocessEnv()`. The flag never leaks back to upstream's test environment.

**Why opt-in:** `tests/unit.test.mjs:226` is a hard `=== 14` assertion. The original instruction was "add base-sepolia to CHAIN_MAP" + "176 upstream tests pass unchanged" — these are mutually exclusive. The opt-in lets us deliver both: tests run with the flag off (=== 14 holds) and the daemon runs with it on (sees Sepolia).

**Why not modify the upstream test:** the Phase 1 contract bans upstream-test edits. The whole point of the verified fork at SHA `c39fb6d` is that upstream tests stay byte-identical so future `git subtree pull` ops re-apply cleanly.

**Files touched (all fenced QM blocks):**
- `cli/cli/lib/chain/registry.js` — import baseSepolia + extension map + helper consultation

**Files NOT touched:**
- `cli/cli/lib/util/validate.js` (reads `SUPPORTED_CHAINS` — sees the flag-gated extension automatically)
- All other upstream code

**Upstreamability:** This is a clean Sepolia-support addition that upstream `zerion-ai` would likely accept as a contributor PR — testnets are a natural hackathon use case. When we open such a PR post-hackathon, the env-flag gating becomes unnecessary (upstream just adds `base-sepolia` to `CHAIN_MAP` and updates the test).

**Follow-up:**
- Phase 4.6 e2e proceeds with the flag set (daemon does this automatically)
- Future upstream sync (next `git subtree pull`): re-apply the fenced block per the comment instructions in DEVIATIONS Phase 2 entry
- Post-hackathon: open a contributor PR to zerion-ai adding base-sepolia + test update

---

### 2026-05-06 — Phase 4.6 e2e deferred (Phase 4.5 e2e attempted, blocked on placeholder addresses)

**What deviated:** Owner kicked off Phase 4.5 + 5 autonomous run with funding "in place," but the message contained literal `<0x...>` template placeholders for principal + subordinate addresses, and `~/.zerion/` did not exist (so `getConfigValue("agentToken")` would have failed when the executor spawned `npx zerion swap/send`).

**From:** Phase 4.5 was supposed to capture real Base Sepolia tx hashes from a live daemon cycle.

**To:** All Phase 4.5 *code* shipped (apy fetcher, pause polling, UUID sentinel). All Phase 5 *dashboard live wire-up* shipped. **J1 rehearsed locally** via `qm test spike --wallet=alpha-1 --rate=1000 --balance=2` + `qm plan --mock-balance=500`: decider planned a top-up, layer-1 dispatcher invoked all 5 policies, **`burn-rate-oracle` rejected with `BURN_RATE_ANOMALY_DETECTED`** and the full reasonText payload ("recent hourly burn 490.42 is 41195× the 7d baseline 0.0119 (threshold 10×)"). Action's `policyChecks[]` shape matches PRD §7 exactly; dashboard's `/actions/[id]` route renders the policy refusal block from this same shape.

Real e2e on Base Sepolia rolls into a new "Phase 4.6" once the owner provides actual hex addresses + `zerion wallet create --agent` is run.

**Why:** Per the deferred-e2e protocol set at Phase 4 kickoff: code + tests + local rehearsal proceed without blocking on funding. The owner's autonomous-run instruction said "if anything mid-flight requires my call, surface it once with options + your recommendation. don't stall waiting for a response you can default-decide." Default decision: skip real-tx e2e, complete code + local J1 rehearsal as the demo proof point.

**What's needed to unblock Phase 4.6 (carried forward from Phase 4 deferral):**
- **Principal wallet** on Base Sepolia (`eip155:84532`) holding USDC + ETH for gas. Real hex address.
- **Treasury source(s)** with a real on-chain USDC balance.
- **Subordinate fleet** addresses with starter USDC balances (5–20 USDC each).
- **`zerion wallet create --agent`** run so the agent token lives at `~/.zerion/config.json` where upstream's executor reads it. Currently `~/.zerion/` does not exist.
- Confirmed x402 mode on Sepolia (or Zerion API key fallback).

**Phase 4.6 procedure:**
1. Owner runs `zerion wallet create --agent --name <demo-bot>` to mint the token + populate `~/.zerion/config.json`.
2. Owner pastes real principal/subordinate addresses to the next-session message.
3. Agent: `zerion fleet add <id> <addr> --chain base-sepolia` × 3, `zerion treasury add usdc-idle <principal-addr> USDC --chain base-sepolia --asset native`.
4. Agent: `zerion qm run` and capture the resulting `topup_send_confirmed` tx hash from `ledger.jsonl`. Verify on Basescan Sepolia.
5. Restart-then-reconcile idempotency check: `kill <daemon>` → `zerion qm run` again → verify `findOrphans()` returns empty.
6. Update AGENT_PROGRESS Phase 4.6 entry with the captured tx hash for README §26.4.

**Follow-up:**
- Next session opens with "go phase 4.6" + actual addresses + confirmation that `~/.zerion/config.json` exists.
- Phase 5 dashboard wire-up is complete — real Sepolia traffic will exercise the live `/api/state` poll path that's currently exercised by `qm plan --mock-balance` for the rehearsal.

---

### 2026-05-06 — Phase 4.5 e2e deferred: blocked on Base Sepolia funding

**What deviated:** PRD §31.5 Phase 4 exit criterion: "Base Sepolia happy-path top-up confirmed via Basescan; tx hashes captured."

**From:** Phase 4 expected to include one full e2e top-up cycle on Base Sepolia with real on-chain transactions, recorded in `AGENT_PROGRESS.md` for the README §26.4 curated tx-hash table.

**To:** Phase 4 ships **all code + unit + integration tests fully green** (331 cli tests / 24 schemas tests, full happy-path + blocked-path through the daemon's tick loop with mocked I/O). The e2e against Base Sepolia is deferred to a separate "Phase 4.5" once the owner provides funded test wallets.

**Why:** Per the deferred-e2e protocol owner specified at Phase 4 kickoff: "if owner hasn't funded principal + fleet + treasury on Base Sepolia at e2e step, write all code + unit + integration tests, all green, skip e2e step, mark explicitly as Phase 4.5 deferred." No funding signal received in this session.

**What's needed to unblock Phase 4.5:**
- **Principal wallet** on Base Sepolia (`eip155:84532`) holding USDC + ETH for gas. This is the QM operator wallet from which top-ups are sourced. Address + funded balance recorded in AGENT_PROGRESS.
- **Treasury source(s)** — at minimum one. Simplest: idle USDC at the principal address (no Aave / stETH on Sepolia required for the demo). Address + USDC balance recorded.
- **Subordinate fleet** — at least one wallet, preferably 3 for a richer demo. Each needs:
  - A small initial USDC balance (say 5–20 USDC) so the watcher can observe burn.
  - The wallet ID, address, and starting balance recorded.
- **Zerion API key** (or x402 mode confirmed working on Sepolia — owner's pre-Phase-4 smoke test outcome).
- **`zerion wallet create --agent`** run to mint the agent token that the executor uses for `npx zerion swap/bridge/send` subprocess calls.

**Phase 4.5 procedure once funded:**
1. `zerion fleet add <subordinate-id> <subordinate-address> --chain base-sepolia` for each subordinate.
2. `zerion treasury add <source-id> <principal-address> USDC --chain base-sepolia --asset <usdc-contract-or-native>`.
3. `zerion qm run` — daemon starts, ticks every 60s.
4. Trigger a tick that fires a real top-up (either by waiting for natural burn or via `zerion qm test spike --wallet=<id> --rate=<low>` to nudge a wallet under threshold without tripping the burn-rate-oracle).
5. Capture the resulting tx hash from `topup_send_confirmed` event in ledger.jsonl + on Basescan.
6. Update `AGENT_PROGRESS.md` Phase 4.5 section with the tx hash, then mark Phase 4 as fully complete.

**Follow-up:**
- Next session opens with "go phase 4.5" + the funding info above.
- Phase 5 (FE wire-up to live daemon) is **NOT** unblocked by Phase 4 code-complete alone — it needs Phase 4.5 e2e to confirm the daemon→dashboard contract works end-to-end against real Sepolia state.
- If the owner's pre-Phase-4 x402-on-Sepolia smoke test fails, Phase 4.5 pivots to small-USDC Base mainnet per Phase 1 / Phase 6 sequencing notes.

---

### 2026-05-06 — Phase 3 two-layer policy split

**What deviated:** PRD §8.1 originally implied a single policy contract registered through upstream's `run-policies.mjs`. Phase 3 step-1 audit surfaced that upstream's existing policy contract is **fundamentally different** from what PRD §8 needs.

**The divergence:**

| Aspect | Upstream `cli/cli/policies/*.mjs` (`check`) | PRD §8.1 (`evaluate`) |
|---|---|---|
| Layer | sign-time guard (tx-level) | decider-time guard (action-level) |
| Function name | `check(ctx)` sync | `evaluate(ctx)` async |
| Result shape | `{ allow, reason? }` | `{ ok, reasonCode?, reasonText? }` |
| Context shape | `{ transaction: { to, data, value }, policy_config }` | `{ proposedAction, targetWallet, selectedSource, allEligibleSources, recentSamples, lastConfirmedActionForTarget, policyConfig, now }` |
| Triggering | OWS engine per `signTransaction` | daemon decider per planned `TopUpAction` |
| Module exports | `check` | `policyName`, `policyVersion`, `evaluate` |

**From:** Single policy system; QM policies registered into upstream's `run-policies.mjs`.

**To:** Two policy layers, each with its own dispatcher. Neither contract is wrong; they guard different concerns:

- **Layer 1 (ours, decider-time)** — `cli/policies/*.mjs` dispatched by `cli/lib/qm/run-policies.js`. Sees domain types. `evaluate(ctx) → { ok, reasonCode?, reasonText? }`.
- **Layer 2 (upstream, sign-time)** — `cli/cli/policies/*.mjs` dispatched by upstream's `run-policies.mjs`. Sees raw EVM tx fields. `check(ctx) → { allow, reason? }`.

Both layers run for every action. Failure at either halts the cycle.

**Why:** Two of our five policies (`yield-curve-preservation`, `burn-rate-oracle`) literally cannot work at sign time — they reason about choices that don't exist yet as transactions. Forcing them into upstream's tx-shaped contract would have required either (a) gutting PRD §8.3 and §8.4 or (b) bridging domain types as side fields on a tx-shaped ctx. Both paths were rejected. The two-layer split keeps each contract honest: upstream guards *signatures*, we guard *decisions*.

PRD §8 updated inline with new §8.0 "Two-layer policy architecture" and a `Layer` column on §8.2.

**Follow-up:**
- README architecture section (Phase 6 / FE work) gets one paragraph on the two layers. Framing pre-baked in `AGENT_PROGRESS.md` Phase 3 entry for the next writer.
- Composition test verifies BOTH layers stay registered (catches the regression where someone moves a file between layers).
- If upstream ever upstreams a domain-aware policy contract, revisit this split.

---

### 2026-05-06 — Phase 2 sanctioned upstream-touch in cli/cli/zerion.js + cli/package.json

**What deviated:** Phase 1 contract said "DO NOT touch upstream files." Phase 2 needed to wire new commands so `zerion fleet add ...` works (PRD §31.3 daily artifact).

**From:** Pure-fork — upstream files byte-identical to the snapshot.

**To:** Two upstream files modified, with explicit fence comments so future upstream syncs can re-apply them verbatim:

1. `cli/cli/zerion.js` — appended a single fenced block:
   ```
   // === BEGIN Quartermaster commands (Phase 2 — fork extension) === ... // === END Quartermaster commands ===
   ```
   Inside the block: 6 imports + 6 `register(...)` calls for fleet/treasury commands.
2. `cli/package.json` — added two dependencies: `@quartermaster/shared-schemas` (workspace-local), `zod` (4.4.3 pinned). The Phase 1 underscore-pin fields (`_upstreamCommit` etc.) were already a sanctioned exception; the dep additions are in the same exception class.

**Why:** Three options were considered:
- **A.** Modify zerion.js + package.json with fenced/minimal additions. Smallest impact, ergonomic (`zerion fleet add` works directly).
- **B.** New sibling entry `cli/zerion-qm.js` + new bin in package.json. Splits the brand (`zerion-qm fleet add` vs `zerion fleet add`).
- **C.** External wrapper at `scripts/qm.mjs`. Fails PRD §31.3 daily artifact which mandates `zerion fleet add ...` works as a shell command.

C was eliminated by spec; B fragments the brand while still touching package.json; A is smallest impact and matches the precedent set by the `_upstreamCommit` field.

**Follow-up:**
- When pulling future zerion-ai upstream commits via `git subtree pull`, the QM block in zerion.js must be re-applied if upstream rewrites the file. The fence comments make this a one-paste operation.
- If upstream upstreams a "command plugin" extension point (PRs welcome there), migrate to it and remove the fence.

---

### 2026-05-06 — Day 0 compressed for velocity

**What deviated:** PRD §27 Day 0 Gate checklist (full set of pre-Phase-1 verifications).

**From:** Complete Day 0 gate before Phase 1 begins. Full §27.1 boxes ticked: doc verification (Zerion CLI, Zerion API, x402, Vercel, Railway), infra liveness probes, principal wallet creation, agent token creation, Base Sepolia + mainnet wallet funding, x402 facilitator smoke test, cost estimate.

**To:** Compressed to **critical-path only** so Phase 1 can start same-day:
- ✅ zerion-ai PR #5 head commit pinned (`c39fb6dcfc59a4c6d9a5bf78fea366a8d16e6099`) — covered by Phase 1 fork
- ✅ `developers.zerion.io/llms.txt` snapshotted to `docs-verified/zerion-api.md` (sha256 + bytes + lines recorded for tamper detection)
- ✅ `github.com/coinbase/x402` README snapshotted at upstream commit `dd927a26cfefc98c24b3ec38b3a8f204dad0c60d` to `docs-verified/x402.md`

**Deferred (recovered on first failure):**
- Vercel + Railway doc snapshots — recover when first deploy hiccup surfaces
- x402 facilitator Base Sepolia smoke test — owner runs this before Phase 4 starts (per session note). If it fails, demo pivots from Base Sepolia to small-USDC Base mainnet — Phase 6 sequencing already plans both branches.
- Principal wallet creation, agent token creation, test wallet funding — owner does these as part of pre-Phase-4 demo prep
- Full cost estimate — recover at Phase 4 once Railway daemon is real

**Why:** Hackathon velocity. PRD §27 was designed for a clean-slate build; we already have monorepo, dashboard scaffold, FE work, and a deployed landing. Running the full Day 0 gate top-to-bottom would push Phase 1 by half a day for marginal information gain. Compressing to "snapshot the two upstream docs that matter for fork verification + spec drift detection" preserves the verification protocol where it pays the most rent.

**Follow-up:**
- Owner: x402 Sepolia facilitator smoke test before Phase 4. Result + branch decision logged here.
- Owner: principal wallet + agent token + Base Sepolia funding before Phase 4 e2e. README "Self-host" section will need real env-var values then.
- Snapshot Vercel docs / Railway docs only if a deploy issue forces us to verify what changed upstream.

---

### 2026-05-05 — Public-demo pivot: Railway daemon + Vercel dashboard

**What deviated:** PRD §21.4 (Deployment targets), implicit in PRD §17 (Landing) and §22 (Dashboard).

**From:**
- Dashboard: LOCAL only — runs alongside the daemon on the user's machine
- Daemon: user's machine, never deployed
- Vercel: landing page only
- Rationale: "no database / no remote state, no Railway/Supabase needed"

**To:**
- Dashboard: **Vercel project B** — public demo UI, reads `NEXT_PUBLIC_DAEMON_URL`
- Demo daemon: **Railway** — fresh Base Sepolia testnet wallet, real x402 calls, real top-ups, real tx hashes
- Production users still self-host the daemon on their own machine; the dashboard binary is the same in both modes (env-var-driven)
- PRD §21.4 updated inline with same-day notice

**Why:** Re-read the hackathon rubric. *Demo Quality* explicitly rewards "allowing judges to understand and **test** the functionality effectively." Local-only forces judges to clone, install, fund a wallet, and run a daemon before they can see anything. With a $2.5k 1st-place prize and an unknown-size submission pool, every other competitive entry will give judges a public URL. The previous PRD over-rotated on production correctness at the expense of demo accessibility.

The pivot keeps the production-correctness story intact: judges see real testnet transactions on a real public daemon; production users still self-host with their own keys. Same code, different env var.

**Follow-up:**
- Phase 4 — ship daemon container, deploy to Railway with fresh Base Sepolia wallet, set `NEXT_PUBLIC_DAEMON_URL` in dashboard's Vercel project B
- Phase 4 — daemon's Hono HTTP layer must enable CORS for the dashboard's Vercel origin
- README "Self-host" section already documents the production path; expand once daemon code lands
- Re-evaluate at submission time whether the public demo wallet's PnL / ledger needs a "this is testnet" banner on the dashboard for clarity

---

## Doc-Verification Drift

### 2026-05-06 — Phase 4 dependency pins (hono / @hono/node-server / pino)

**What deviated:** PRD §21.2 pinned versions table — pino starting point.

**From:** `pino 9.x` (PRD §21.2 starting point).

**To:** `pino@10.3.1` (exact, no caret). pino v10 is the current stable line; v9 is in maintenance only. Surface we consume (root logger, child loggers, level methods) is unchanged from v9. Snapshot in `docs-verified/pino.md` with content sha256 + relevant migration notes.

**Also pinned (no drift, inside spec):**
- `hono@4.12.17` (PRD §21.2 said `hono 4.x` — inside range). Snapshot in `docs-verified/hono.md`.
- `@hono/node-server@2.0.1` — required Node adapter for Hono. Not in PRD §21.2; added at Phase 4. Logged here for completeness.

**Why:** pino bump for the same reason as zod 3 -> 4: latest stable line picked at first use to avoid a future migration. Hono and the Node adapter are exactly what PRD §21.2 anticipated.

**Follow-up:**
- Re-snapshot before each minor bump.
- Phase 6 CORS expansion will re-touch `docs-verified/hono.md`.

---

### 2026-05-06 — zod major-version bump from PRD §21.2

**What deviated:** PRD §21.2 pinned versions table.

**From:** `zod 3.23+` (starting point).

**To:** `zod 4.4.3` (exact pin, no caret) in both `packages/shared-schemas/package.json` and `cli/package.json`. Snapshotted to `docs-verified/zod.md` with content sha256 + relevant breaking-change notes for v3 → v4 transition.

**Why:** Latest 3.x is `3.9.8` (maintenance only). Active development is on 4.x; v4 has been stable since mid-2025. Picking v4 today avoids a future migration. Our schema usage is a minimal subset (`z.object().strict()`, `z.discriminatedUnion("type", [...])`, `z.enum`, `.parse`, `.safeParse`) that has identical surface in v3 and v4 — downgrade would be near-zero cost if needed.

**Follow-up:**
- Re-snapshot `docs-verified/zod.md` before each minor bump (4.5+).
- If a Phase 4 daemon dep (e.g., `hono`) pins a different zod major, revisit.

---

### 2026-04-30 — Initial scaffold version pins

**What deviated:** PRD §21.2 pinned versions table.

**From:**
- `next` 15.0+
- `pnpm` 9.x
- `recharts` 2.12+
- `lucide-react` latest

**To:**
- `next` 16.2.4 (exact pin) — what `pnpm create next-app@latest` resolved on init
- `pnpm` 9.15.5 (corepack-activated; `packageManager` field)
- `recharts` ^3.8.1 — major version bump from PRD spec; latest stable
- `lucide-react` ^1.14.0 — lucide hit 1.0 since PRD draft

**Why:** PRD §21.2 explicitly notes "starting points. Day 0 verification updates them." The latest stable resolves were chosen on init so the lockfile is reproducible and the FE dev gets current versions on first clone.

**Follow-up:**
- Day 0 — verify `recharts@3` API compatibility with the chart components specified in `FRONTEND_BRIEF.md` (axis style, tooltip style, gridlines). If breaking changes are unworkable, downgrade to `2.x`.
- Day 0 — verify `lucide-react@1.x` icon names against the icon strip referenced in landing copy. If breaking, downgrade to `0.4xx`.
- Update PRD §21.2 to match these pins once verified.

### 2026-05-05 — Landing page motion budget violations

**What deviated:** `FRONTEND_BRIEF.md` "Motion budget" section.

**From:** `160ms transitions, no parallax, no auto-playing animations, only permitted decoration is a 200ms opacity pulse on values that just updated`.

**To:** `apps/landing/app/page.tsx` (commit `47201af` and prior) imports `framer-motion` and uses it for:
- Hero word-by-word reveal on mount (durations 500–600ms)
- Section reveals on scroll via `useInView` (durations 600ms, staggered)
- Stagger card grid reveals on scroll
- SVG architecture-diagram path draws on scroll (800ms each, staggered)
- Self-cycling terminal animation looping every 4s indefinitely (`runTerminal()` in `useEffect`)

**Why:** FE dev shipped Phase B against an interpretation of the brief that allowed scroll-triggered reveals and on-mount entrances. Multiple violations against the brief's plain text:
1. Durations exceed the 160ms budget (most are 500–800ms).
2. `useInView` is scroll-triggered auto-play; brief explicitly forbids "auto-playing animations."
3. Terminal cycle is a continuous auto-play; same forbidden category.
4. Hero word reveal is mount-triggered auto-play; same.

The `framer-motion` dependency itself is fine — it's the motion patterns that violate the brief.

**Follow-up:**
- **Owner action:** confirm brief's motion budget is the locked spec, or amend brief if the brief was over-strict.
- If brief stands: open a follow-up PR on FE side to (a) reduce all transition durations to ≤160ms, (b) replace `useInView`/scroll-triggered reveals with static rendering, (c) remove terminal `runTerminal()` cycle (render the final state statically), (d) keep `framer-motion` package or remove if no compliant uses remain.
- This PR (`feat/dashboard-env-var-daemon-url`) does NOT touch `apps/landing/app/page.tsx` — FE dev's code, FE dev's call. Flagged in PR description.

**Resolution — 2026-05-07 (Phase 6):** Brief stands. Rewrote `apps/landing/app/page.tsx` to render the final state statically. All `framer-motion` usage removed; the dependency has been dropped from `apps/landing/package.json`. The terminal pane now shows the final J1 + happy-path state as static text (no `setTimeout` cycle). Section reveals replaced with normal flow. Per-element transitions live in CSS via Tailwind `transition-colors duration-150` (≤160ms budget). `pnpm typecheck` + `pnpm --filter landing build` both green. **Closed.**

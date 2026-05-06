# AGENT_PROGRESS

The session-to-session handoff document. Per `MASTER_PRD.md` §28 every Claude Code (or any agent) session begins by reading this file in full and ends by appending a new entry.

This file is not the PRD. The PRD is the source of truth for *what* to build. This file is the running log of *what's actually been done, what broke, and what's blocked.*

## Reading protocol (every agent, every session)

1. Read this file top-to-bottom before doing any work.
2. Read `MASTER_PRD.md` for any sections relevant to the current task.
3. Read `gap.md` to understand FE-side blockers and ambiguities.
4. Read `docs-verified/DEVIATIONS.md` to understand version/spec drift.
5. Then start work. Append a new entry at the end of this file when done.

## Writing protocol

Append a new entry per session. Format:

```markdown
## YYYY-MM-DD — <agent or human> — <session goal in 8 words or fewer>

**Phase:** 0 / 1 / 2 / 3 / 4 / 5 / 6 (per PRD §31)
**Started from:** <commit SHA>
**Ended at:** <commit SHA>

### Done
- one bullet per shipped artifact, file path, or merged change

### Blocked / open
- one bullet per known blocker, with the specific question or missing input

### Next
- one bullet per next concrete task, ordered by priority

### Decisions made (only the non-obvious ones)
- one bullet per non-obvious choice, with the reason
```

Keep entries terse. The diff is in git; this file captures *intent and state*, not code.

---

## 2026-04-30 — Claude Code (Opus 4.7) — repo init + handoff scaffold

**Phase:** 0 (pre-Day-0)
**Started from:** empty `/Users/mac/quartermaster/` directory + 3 markdown docs (`MASTER_PRD_v2.md`, `FRONTEND_BRIEF.md`, `HANDOFF.md`)
**Ended at:** initial commit on `main`, pushed to `git@github.com:winsznx/quartermaster.git`

### Done
- `git init -b main` with user `winsznx <xidoncapitals@gmail.com>`
- `.gitignore` (covers node_modules, .next, .env, ledger.jsonl, .vercel)
- pnpm workspace root: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- corepack-activated `pnpm@9.15.5` via `packageManager` field
- `apps/landing/` — Next 16.2.4, React 19.2.4, Tailwind v4, App Router, no eslint, turbopack, lucide-react, clsx
- `apps/dashboard/` — same stack + recharts, tailwind-merge, zod, shadcn/ui (base-nova style, neutral base, 10 components: button, card, table, tabs, dialog, badge, tooltip, separator, scroll-area, skeleton)
- `packages/shared-schemas/` — placeholder zod-schema package wired to both apps
- Dashboard dev/start scripts pinned to port 3001
- Skeleton dirs with READMEs: `cli/`, `docs-verified/`, `scripts/`
- `docs-verified/DEVIATIONS.md` initial entry (version pin drift from PRD §21.2 documented)
- `apps/dashboard/lib/fixtures/state.json` skeleton
- Renamed `MASTER_PRD_v2.md` → `MASTER_PRD.md` (canonical, no version suffix)
- Root docs: `README.md`, `gap.md`, this file (`AGENT_PROGRESS.md`), `.env.example`
- `apps/landing/vercel.json` for one-click Vercel import (root dir = `apps/landing`)
- `LICENSE` (MIT)
- `.github/workflows/ci.yml` — typecheck + build on PR
- `pnpm install && pnpm -r build` verified green before commit

### Blocked / open
- **Vercel project not created yet.** Tim does this manually via web UI: vercel.com → import `winsznx/quartermaster` → set Root Directory = `apps/landing` → deploy. After that, future builds = environment variable changes only.
- **GitHub repo collaborators not added.** Tim adds the FE dev when ready.
- **Day 0 verification not run.** PRD §27 checklist must execute before any code phase begins.

### Next
- Tim: deploy `apps/landing` to Vercel from web UI
- Tim: run Day 0 gate per PRD §27 — verify Zerion docs, x402 facilitator on Base Sepolia, principal wallet, agent token, fund test wallets
- Tim: send DM from `HANDOFF.md` Part 1 to FE dev with repo URL
- FE dev: read `FRONTEND_BRIEF.md`, set up locally, first PR = theme tokens + layout shell

### Decisions made (only the non-obvious ones)
- **pnpm pinned 9.15.5 not 10.x:** PRD §21.2 says 9.x. Corepack activates exactly what `packageManager` says, so reproducibility wins over "latest stable."
- **shadcn `base-nova` style:** `shadcn@latest init -d` defaults gave this; it's the new shadcn 3.x style. Tailwind v4 CSS-first was set up automatically. Did NOT customize base color away from `neutral` — the FE dev will override CSS variables in `globals.css` per `FRONTEND_BRIEF.md` "Specie" theme. Don't fight the defaults; override at the variable layer.
- **Recharts 3.x and lucide-react 1.x:** both are major-version bumps from PRD §21.2 starting points. Logged in `DEVIATIONS.md` with Day 0 follow-up to verify chart/icon API compatibility before committing further.
- **No CONTRIBUTING.md, no code of conduct, no issue templates:** hackathon repo, two contributors, fourteen days. Skip the open-source-project ceremony.
- **CI workflow runs typecheck + build only:** no test job because there are no tests yet (Phase 0 — tests land in Phase 2+ per PRD §25). Add a test job when the first test file is committed.
- **`PRD_v2` → `MASTER_PRD.md`:** drop the version suffix per "no drift, one source of truth" rule. Old version lives in git history if needed.

---

## 2026-05-02 — Antigravity — Phase A: Environment setup + token wiring

**Phase:** A
**Started from:** commit on `main` following Phase 0 completion
**Ended at:** <pending commit SHA>

### Done
- Read `AGENT_PROGRESS.md`, `MASTER_PRD.md`, `FRONTEND_BRIEF.md`, `docs-verified/DEVIATIONS.md`, `gap.md`
- Verified `pnpm install` from repo root passes
- Updated Specie CSS variables in `apps/landing/app/globals.css` and `apps/dashboard/app/globals.css` with dark and light modes
- Wired Tailwind v4 `@theme` directives in both globals.css files mapping to CSS variables
- Verified font setup: Fraunces, Inter, JetBrains Mono in landing; Inter, JetBrains Mono in dashboard
- `ThemeToggle` component implemented and mapped to `ThemeProvider` in dashboard `layout.tsx`
- Adjusted `badge.tsx` and `skeleton.tsx` to match Specie tokens directly where needed
- Overridden shadcn tokens in dashboard `globals.css`
- Validated contrast checks for Specie color combos and noted oxblood text anomaly in `gap.md`
- Replaced the default Next.js template in `apps/landing/app/page.tsx` to remove hardcoded hex values, starting the Phase B Hero shell

### Blocked / open
- Landing port 3000 was reported occupied in `gap.md`, landing dev server configured to use port 3002

### Next
- Proceed to Phase B: Landing page (Days 2-4)
- Implement Asciinema embed via `next/script`
- Complete sections 2-7 of the landing page

### Decisions made (only the non-obvious ones)
- `badge.tsx` was overridden manually to handle the `destructive` oxblood color requirement properly and `rounded-4xl` was replaced with `rounded-[2px]` per PRD specs.
- Mapped shadcn utility classes (e.g., `bg-background`) in `globals.css` to automatically use `var(--color-bg)` instead of updating the string inside every `.tsx` component, allowing clean upstream shadcn updates.

---

## 2026-05-05 — Claude Code (Opus 4.7) — Architectural pivot: public deployment + env-var refactor

**Phase:** Phase boundary — closes Phase A (FE shell), enables Phase B/dashboard public deploy + Phase 4 daemon-on-Railway.
**Started from:** `47201af` (post FE PR #1 merge, Phase A complete)
**Ended at:** `<commit SHA after this branch merges>` on `main` via PR `feat/dashboard-env-var-daemon-url`

### Done
- **Architectural pivot logged.** PRD §21.4 updated inline; full rationale in `docs-verified/DEVIATIONS.md` under new *Architectural Pivots* section. Driver: re-read of hackathon rubric — *Demo Quality* explicitly rewards "allowing judges to test the functionality effectively," which local-only architecture would not satisfy.
- **Dashboard daemon URL is now env-var-driven.** New `apps/dashboard/lib/daemon-url.ts` exports `DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_URL ?? "http://127.0.0.1:7402"`. Both fetch sites (`components/daemon-status-pill.tsx`, `components/daemon-banner.tsx`) consume it. No other call sites in dashboard today.
- **`apps/dashboard/.env.example`** documents the var with both self-host and Railway example values.
- **`README.md` rewritten:** three-row deployment table (landing → Vercel A, dashboard → Vercel B, daemon → Railway/Phase 4), new "Self-host" section for production users, broken `image.png` line removed.
- **`docs-verified/DEVIATIONS.md` restructured** with two top-level sections — *Architectural Pivots* (new pivot entry) and *Doc-Verification Drift* (existing version-pin entry, plus a new entry on landing motion budget violations against `FRONTEND_BRIEF.md`).
- **`pnpm typecheck` + `pnpm build` green** before commit.

### Blocked / open
- **Owner decision needed: motion budget on landing.** `FRONTEND_BRIEF.md` locks 160ms transitions, no parallax, no auto-playing animations. `apps/landing/app/page.tsx` (FE dev's commit) uses `framer-motion` for hero reveals (500–600ms), scroll-triggered section reveals via `useInView` (600ms), stagger card grids, SVG path draws (800ms), and a self-cycling terminal animation that loops every 4s. This PR does NOT touch landing — flagged in PR description for FE rip-out follow-up. Owner must confirm brief stands or amend it.
- **Vercel project B (dashboard) not yet deployed.** It builds; needs an import + Root Directory set to `apps/dashboard`. Will show offline state until Phase 4 ships the Railway daemon and `NEXT_PUBLIC_DAEMON_URL` is set.
- **Railway daemon not deployed.** Comes in Phase 4. Daemon code itself doesn't exist yet (forked Zerion CLI lands in Phase 1).

### Next
- **Owner:** redeploy `apps/landing` to Vercel project A (existing project mistakenly imported `apps/dashboard` — change Root Directory to `apps/landing` in Settings, redeploy).
- **Owner:** import a second Vercel project B for `apps/dashboard` (Root Directory = `apps/dashboard`). Don't set `NEXT_PUBLIC_DAEMON_URL` until Railway daemon is up — let it default to localhost; the offline state will render until then.
- **Owner:** send framer-motion drift entry to FE dev as a follow-up PR ask. Do NOT block this PR on it.
- **Next agent:** after both Vercel deploys are green, run gap analysis per owner-supplied format (FE-shipped surface area vs PRD §22.3 endpoints vs fixture shapes vs §31 phase plan).
- **Phase 1:** fork zerion-ai into `cli/`. Begin daemon scaffold.

### Decisions made (only the non-obvious ones)
- **Centralized daemon URL in `lib/daemon-url.ts`** rather than inlining `process.env.NEXT_PUBLIC_DAEMON_URL ??` at each call site. Reasoning: Phase 4 will add many more daemon API call sites (`/api/state`, `/api/fleet`, `/api/actions`, etc.); centralizing now means those sites import a constant rather than repeating the env-var dance. Also makes a future swap to a URL-builder pattern cheap.
- **Did not remove `framer-motion`** despite motion-budget violations. Reason: the package is fine; the *usage* is what violates the brief. Removing the package would force-break FE dev's code instead of giving her a clean follow-up surface. Logged in DEVIATIONS, flagged in PR description, FE owns the cleanup PR.
- **Did not modify `apps/landing/app/page.tsx`** despite seeing the violations. Reason: my profile says don't refactor while fixing; this PR is scoped to the env-var refactor. Mixing in a motion-budget cleanup would (a) explode the PR, (b) step on FE dev's code, (c) violate the locked scope owner gave for "now PR."
- **PRD §21.4 update is in-place, not a new section.** Spec = source of truth, drift = bad. The pivot becomes the new spec; the rationale lives in DEVIATIONS for archaeology.
- **DEVIATIONS structure split into two top-level sections** per owner instruction so future readers can distinguish "we changed our minds based on new info" from "the world drifted away from our plan." Different protocols apply: pivots usually update the PRD; drift usually updates the code or reaffirms the spec.


---

## 2026-05-06 — Claude Code (Opus 4.7) — Phase 1: fork zerion-ai at PR #5 + Day 0 compressed

**Phase:** 1 (Fork upstream CLI). Day 0 critical path also closed in this PR.
**Started from:** `06f46fa` (post env-var pivot merge)
**Ended at:** `<commit SHA after this branch merges>` on `main` via PR `phase-1/fork-zerion-ai-pr5`

### Done

**Gap analysis (precursor work):**
- Read every dashboard page, fixture, component. Established that **only `/overview` is wired** against `state.json`; the other 9 routes are styled empty states. Fixtures `treasury.json` and `settings.json` exist but are orphans (no page imports them).
- Mapped fixture-shape delta vs PRD §22.3 + §7. Daemon must emit a merged /api/state shape that joins SubordinateWallet config + latest BurnRateSample fields per wallet, plus server-derived `kpis` and `policyStats`.
- Produced ordered gap list (11 endpoints, P0–P3) and compressed 7-phase plan with sequence diagram. Posted to owner.

**Phase 1 scope:**
- `git remote add zerion-ai https://github.com/zeriontech/zerion-ai.git` (kept locally; not pushed as repo remote).
- `git fetch zerion-ai pull/5/head` → resolved to upstream commit `c39fb6dcfc59a4c6d9a5bf78fea366a8d16e6099` (zerion-ai PR #5 head as of 2026-05-06).
- Cleared placeholder `cli/README.md` in a chore commit so subtree-merge could land cleanly.
- `git subtree add --prefix=cli c39fb6dc...6099 --squash` — upstream tree at the pinned SHA is now under `/cli/`.
- Pinned the SHA in `cli/package.json` via four underscore-prefixed top-level fields (`_upstreamRepo`, `_upstreamRef`, `_upstreamCommit`, `_upstreamPinnedAt`) plus an `_note` explaining the convention. npm/pnpm ignore unknown top-level fields, so this is a zero-runtime-impact addition.
- Added `cli` to `pnpm-workspace.yaml` so the workspace picks up upstream as a member package.
- `pnpm install` resolved upstream's deps (107 new packages: viem, @solana/web3.js, @x402/*, @open-wallet-standard/core, qrcode-terminal, native-binding deps for utf-8-validate/bufferutil). One harmless peer-dep warning (`utf-8-validate@^5.0.2` requested by `ws@7` deep under `@solana/web3.js → jayson`; we have `^6.0.6`. Not blocking.).
- `pnpm --filter ./cli test` runs upstream's `node --test tests/*.test.mjs` unchanged: **190 tests, 176 pass, 0 fail, 14 skipped** (skips are network-gated integration tests that need Zerion API key / live wallet — expected).

**Day 0 (compressed) snapshots:**
- `docs-verified/zerion-api.md` ← `https://developers.zerion.io/llms.txt` (14708 bytes, 81 lines, sha256 `09676c10becb...1271aff3c`).
- `docs-verified/x402.md` ← `coinbase/x402` README at upstream commit `dd927a26cfefc98c24b3ec38b3a8f204dad0c60d` committed 2026-04-21 (8544 bytes, 167 lines, sha256 `f424586f12c9...49fa70e9650122c`).
- Both snapshots include metadata header per `docs-verified/README.md` schema (source URL, verified_at, content sha256, byte/line count for tamper detection).
- `docs-verified/DEVIATIONS.md` updated under *Architectural Pivots* with the Day 0 compression entry — list of deferred items + recovery triggers.

### Blocked / open
- **x402 Sepolia facilitator smoke test** — owner runs this before Phase 4 starts. Result determines Phase 6 demo branch (Sepolia-default vs mainnet-small-USDC fallback). Both branches already in compressed phase plan.
- **Principal wallet + agent token + test wallet funding** — owner does these as part of pre-Phase-4 demo prep. Not blocking until Phase 4.
- **CI workflow update** — current `.github/workflows/ci.yml` runs `pnpm typecheck` + `pnpm build`. Now that `cli/` is in the workspace, CI should also run `pnpm --filter ./cli test`. Not done in this PR (out of scope for "fork + verify only"); recommended for a tiny follow-up PR.

### Next
- **Phase 2 (next session):** schemas + registries + fleet/treasury commands. PRD §31.3 scope: `packages/shared-schemas/` zod definitions (the missing source of truth for the merged /api/state shape), `cli/lib/{fleet,treasury}/`, new CLI commands. **This phase generates the daemon-side shapes that /api/state will emit** — feeds gap-list items 1–7. Tests per §25.
- Owner: review + merge this PR. Then `git pull` locally so cli/ is on disk.
- Owner: x402 Sepolia smoke before Phase 4 (no time pressure on Phase 2).

### Decisions made (only the non-obvious ones)

- **Pinned SHA via `_upstreamCommit` field in `cli/package.json` rather than only the subtree commit message.** Per owner instruction: "pin zerion-ai PR #5 head commit in cli/package.json". The underscore-prefixed convention means npm/pnpm ignore the field; it's a documentation pin readable by `cat cli/package.json | jq '._upstreamCommit'`. The subtree-merge commit message already records the SHA in git history, but a fresh agent reading the repo without git log shouldn't have to dig.
- **Path-based filter `pnpm --filter ./cli test` instead of name-based.** Upstream package name is `zerion`, not `cli`. Path-based filter is more readable in CI / scripts (clear what directory is being tested) and survives any future upstream package renames.
- **No new `cli/` README at QM scope.** Owner said "DO NOT touch upstream files." The placeholder I had at Phase 0 is gone; upstream's own README is now at `cli/README.md`. QM-specific fork notes live in `cli/package.json` underscore fields, `AGENT_PROGRESS.md` (this entry), and `docs-verified/DEVIATIONS.md`. When Phase 2 adds `cli/commands/qm/` etc., we'll add a sibling `cli/QM_README.md` (or similar non-conflicting filename) — not now.
- **Bundled Day 0 snapshots into Phase 1 PR rather than two separate PRs.** Owner said "single PR titled 'phase 1: fork zerion-ai at PR #5 <sha>'" but also listed the doc snapshots in same message. Bundling keeps merge ceremony minimal; the PR title still reads as Phase 1 because the fork is the bulk of the change. DEVIATIONS captures the Day 0 compression separately.
- **`/cli/cli/zerion.js` (nested cli) is correct, not weird.** Upstream has `cli/` as a subdirectory inside its own repo root. After subtree-merge `--prefix=cli`, upstream's root becomes `/cli/`, so upstream's `cli/zerion.js` becomes `/cli/cli/zerion.js`. The bin path `"./cli/zerion.js"` resolves correctly from `/cli/package.json`. Don't flatten; it would diverge from upstream and break clean re-pulls of new SHAs.

---

## 2026-05-06 — Claude Code (Opus 4.7) — Phase 2: schemas + registries + fleet/treasury commands

**Phase:** 2 (Schemas + registries + fleet/treasury commands per PRD §31.3 + gap-list items 1–7).
**Started from:** `7ad14db` (Phase 1 + Day 0 commit on `phase-1-7/integration`)
**Ended at:** `<commit SHA after this commit>` (local only — push gate sealed)

### Done

**Step 1 — Shape drift audit (precursor):**
- Read every fixture in `apps/dashboard/lib/fixtures/` (`state.json`, `treasury.json`, `settings.json`).
- Read `/overview/page.tsx` (only fixture-consumer), `RunwayChart`, `LedgerTable` for field-access patterns.
- Compared FE access patterns vs PRD §7 + §22.3.
- Result: **no non-trivial drift.** The fleet-with-derived-runway pattern FE uses is explicitly mandated by PRD §22.3 (`/api/fleet` returns "SubordinateWallet[] + per-wallet derived runway"). Orphan fixtures (`treasury.json`, `settings.json`) are not consumed and need not match PRD until Phase 5.

**Step 2 — zod verification:**
- `docs-verified/zod.md` snapshotted from zod v4.4.3 README (sha256 `0ae96d908...3c27500e`, 5582 bytes, 191 lines) with v3→v4 migration notes for our usage subset.
- `packages/shared-schemas/package.json` and `cli/package.json` both pin `zod` exactly at `4.4.3` (no caret).
- Bump from PRD §21.2's `3.23+` starting point logged under *Doc-Verification Drift* in DEVIATIONS.

**Step 3 — Style mirror:**
- Read `cli/cli/commands/wallet/list.js` and `cli/cli/commands/analytics/portfolio.js` to learn upstream's command shape: default-export `async (args, flags)`, `print(data)` for stdout JSON, `printError(code, message)` + `process.exit(1)` on failure, try/catch around the main logic. New QM commands match this exactly.

**Step 4 — Implementation:**
- `packages/shared-schemas/src/primitives.ts` — `Address`, `TxHash`, `ChainId`, `WalletId`, `SourceId`, `Uuid`, `IsoTimestamp` with regex/refinement validators.
- `packages/shared-schemas/src/domain.ts` — every PRD §7 type as a strict zod schema: `SubordinateWallet`, `TreasurySource`, `BurnRateSample`, `PolicyCheck`, `TopUpAction` (with the full state enum), `LedgerEvent` (discriminated union over `type` covering all 19 variants).
- `packages/shared-schemas/src/api.ts` — HTTP API response shapes per gap analysis: `HealthInfo`, `WalletWithDerived` (the SubordinateWallet+sample join), `Kpis`, `PolicyStats`, `StateResponse`, `FleetResponse`, `FleetWalletDetailResponse`, `TreasuryResponse`, `ActionsResponse`, `ActionDetailResponse`, `PolicyRegistryEntry`, `PoliciesResponse`, `PolicyDetailResponse`, `SettingsResponse`. Every endpoint in PRD §22.3 has a typed response shape now.
- `packages/shared-schemas/src/index.ts` — re-exports all of the above.
- `cli/lib/qm/storage.js` — `qmPath()`, `readJsonOrDefault()`, `writeJsonAtomic()` (temp+rename per PRD §13.2). Sandboxable via `QM_HOME` env var for tests.
- `cli/lib/fleet/registry.js` — CRUD on `~/.zerion/quartermaster/fleet.json`. Validates on every read AND every write so hand-edited corruption surfaces at next CLI invocation, not silently downstream.
- `cli/lib/treasury/sources.js` — CRUD on `~/.zerion/quartermaster/treasury.json`.
- `cli/commands/fleet/{add,list,remove,status}.js` — six command files mirroring upstream style.
- `cli/commands/treasury/{add,list}.js`.
- `cli/cli/zerion.js` — fenced QM block (`// === BEGIN Quartermaster commands ===` ... `// === END ===`) appended just before `// --- Dispatch ---`. 6 imports + 6 `register(...)` calls. Logged in DEVIATIONS as the sanctioned Phase 2 upstream-touch.
- `cli/package.json` — added `@quartermaster/shared-schemas: workspace:*` and `zod: 4.4.3` to dependencies. Same exception class as Phase 1's underscore pins.
- `tsconfig.base.json` — added `allowImportingTsExtensions: true` so the base config matches Node 24's runtime resolution (`.ts` extensions in imports).
- `packages/shared-schemas/package.json` — added `"type": "module"` (eliminates Node's `MODULE_TYPELESS_PACKAGE_JSON` warning) and a `test` script.

**Step 5 — Tests + verifications:**
- `packages/shared-schemas/tests/schemas.test.mjs` — 24 tests across primitives, domain types, LedgerEvent variants, API response shapes. Includes a "covers every variant defined in PRD §7" check that asserts the discriminated union has all 19 declared `type` literals, so any future PRD §7 addition forces a test update.
- `cli/tests/qm-fleet-registry.test.mjs` — 10 tests, sandboxes `~/.zerion` via `QM_HOME`. Covers schema validation, duplicate-id rejection, atomic write artifacts, and corruption-detection on hand-edit.
- `cli/tests/qm-treasury-registry.test.mjs` — 8 tests, same pattern.
- **Counts before / after Phase 2:**
  - cli upstream tests: 190 tests / 176 pass / 14 skipped (network-gated) → after: 208 tests / **194 pass** / 14 skipped. Upstream's 176 pass count is unchanged.
  - shared-schemas: 0 → **24 pass / 0 fail / 0 skipped**.
  - Total Phase 2 contribution: 18 cli tests + 24 schema tests = 42 new passing tests.
- `pnpm typecheck` green across all 4 TS workspace projects (apps/landing, apps/dashboard, packages/shared-schemas, cli is plain JS so skipped).

### Blocked / open
- **Daily artifact for PRD §31.3** (`zerion fleet add demo-1 0x...` writes to `~/.zerion/quartermaster/fleet.json`) is implemented and unit-tested via the registry, but I have not invoked it as a shell command end-to-end. The wiring through upstream's router is unit-covered by upstream's `router command parsing` tests (still passing). A manual smoke-test (`node cli/cli/zerion.js fleet add ...`) would close this — owner can confirm or skip until Phase 4.
- **Upstream's tests for `fleet`/`treasury` namespace** — there's no upstream test that asserts unknown commands surface a helpful error. Our additions don't change that surface; nothing to do here.
- **`@x402/*` peer-dep warning** persists from Phase 1 (utf-8-validate v5/v6 deep under @solana → jayson → ws). Non-blocking; Phase 4 may revisit if x402 calls fail at runtime.

### Next
- **Phase 3:** policies. Five policy files under `cli/policies/` (4 new + the upstream `allowlist`). Per PRD §31.4. Tests per §25.2. Reuses the schemas shipped here.
- **Owner:** review Phase 2 commit. Optional smoke test: `node cli/cli/zerion.js fleet add demo-1 0x1234567890123456789012345678901234567890 --chain base` and verify a `fleet.json` appears under `~/.zerion/quartermaster/`.

### Decisions made (only the non-obvious ones)

- **Schemas in TS, not .mjs.** Trade-off: TS gives `z.infer<>` types for the daemon and dashboard imports; .mjs would force consumers to derive types manually. With Node 24 default type-stripping + `allowImportingTsExtensions: true`, TS files run as-is in CLI commands without a build step. `.ts` extension required in cross-schema imports (Node 24's resolver does NOT auto-fall-back from `.js` to `.ts`). One smoke-test confirmed this works.
- **Strict mode (`.strict()`) on every persisted schema** (`SubordinateWallet`, `TreasurySource`, etc.). Reason: the registry validates fleet.json/treasury.json on every read, and unknown keys in those files almost always indicate hand-edit drift (typo, leftover field after a schema migration). Failing loud surfaces it at the next `zerion fleet list`, not three watcher cycles later when the field would have been silently dropped.
- **`WalletWithDerived` as `SubordinateWallet.extend(...)`** rather than a separate type. Reason: the join is dashboard-convenience, not a real domain entity. Extending makes the inheritance explicit and the daemon code reads cleanly: emit `{ ...wallet, ...latestSample.pick(...) }`. Also keeps the runtime wire-up testable: any future `SubordinateWallet` field automatically appears in `WalletWithDerived` without a separate update.
- **`LedgerEvent` exhaustive-variant test.** Asserts that all 19 PRD §7 event variants are represented in the discriminated union. If we later add a 20th event type to PRD §7 and forget to add it to the schema, the test fails with the missing variant name. Cheap insurance against drift.
- **Sandboxing tests via `QM_HOME` env var** rather than mocking `homedir()`. Reason: production code reads `process.env.QM_HOME || homedir()/.zerion/quartermaster`. Tests set `QM_HOME` to a tmpdir, and the same code path runs unmodified. No mocking framework, no monkey-patching `os` module, no surprises in production. The env var becomes a documented escape hatch for ops too (e.g., parallel daemons on one host).
- **CLI command files at `cli/commands/{fleet,treasury}/`, NOT `cli/cli/commands/{fleet,treasury}/`.** The latter would put us inside upstream's command tree; the former is a peer directory at QM scope. The fenced block in `cli/cli/zerion.js` imports `../commands/fleet/add.js` (one `..` up to `/cli/`, then into `/cli/commands/...`). Keeps the QM/upstream split visible.
- **Did NOT add a `zerion qm` namespace yet.** Phase 4 introduces `zerion qm run/pause/resume/...` per PRD §31.5. We could have created the `qm` namespace empty in Phase 2, but YAGNI — adding it Phase 4 is two extra `register(...)` calls. The current fenced block is the smallest possible upstream-touch for the Phase 2 deliverable.
- **No `--pretty` formatter for our commands.** Upstream commands ship `formatWalletList`-style pretty formatters. Ours emit JSON only. Reason: the registry surface is operator-facing for `zerion qm run` configuration, not human-glance — the daemon and dashboard are the two real consumers. If FE wants a pretty view at Phase 5, we add it then.

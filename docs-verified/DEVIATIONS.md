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

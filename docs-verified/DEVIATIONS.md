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

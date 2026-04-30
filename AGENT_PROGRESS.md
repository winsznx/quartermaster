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

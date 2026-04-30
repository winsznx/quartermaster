# DM message + repo init steps

---

## Part 1 — The DM message

Send this to her once the repo is initialized, pushed to GitHub, and she has access. Adjust the parts in `<…>` to match reality.

---

> Hey <name>! 🤝
>
> Got a hackathon submission going for the Colosseum Frontier — Zerion CLI track. Two-week build. I'm doing the protocol/CLI/daemon side; would love you on the frontend if you're in.
>
> The repo's here: `<github-url>`
>
> Two things to read in order:
>
> 1. `FRONTEND_BRIEF.md` at repo root — your scope, distilled. ~400 lines. Read this first, it's enough to start.
> 2. `MASTER_PRD_v2.md` — the full product spec if you want depth on architecture or rationale. Not required reading; reach for it when the brief points there.
>
> Quick framing in 30 seconds: x402 (the new HTTP payment protocol Coinbase launched, now Linux Foundation infra) makes AI agents pay USDC per API call. They run dry. Quartermaster watches a fleet of agent wallets, projects when each will starve, and tops them up from the principal's yield positions — within five composable on-chain policies. It's the treasury layer for the agent economy.
>
> Two surfaces to build:
>
> - **Landing page** (`apps/landing/`) — public marketing site, deploys to Vercel
> - **Dashboard** (`apps/dashboard/`) — local-only ops UI that polls the daemon at 127.0.0.1
>
> The brief explains exactly what's locked (system: tokens, route map, components, principles) vs. what's yours (the craft: page-by-page UX, microcopy, empty/loading/error states, onboarding, action timelines). I want this to feel like one product, not glued-together pages — connective tissue is yours to design.
>
> Stack: Next 16 latest, React 19.2+, Tailwind v4, shadcn, Recharts, Lucide, pnpm workspace. All set up.
>
> Theme is "Specie" — antique gold on anthracite, parchment in light. **Not crypto-neon.** Think nineteenth-century counting house ledger rendered in a terminal. Trust, weight, permanence. Brief has all the tokens.
>
> Workflow:
> - Branches: `frontend/<scope>`
> - PRs small, one route or component cluster at a time
> - Each PR: description + screenshot + any decisions you made that aren't in the brief
> - Anything design/product → DM me. Anything backend/API → open a `question:` issue.
>
> Timeline I'm hoping for:
> - Days 1–2: setup, theme tokens, layout shell
> - Days 3–5: landing complete + deployed to Vercel preview
> - Days 6–9: Dashboard Overview against fixtures
> - Days 10–12: remaining dashboard routes
> - Day 13: polish, Lighthouse, cross-browser
> - Day 14: bugs only. Hard freeze.
>
> Few things you'll appreciate knowing upfront:
> - **No mock data, no demo modes.** Even when developing against fixtures, fixtures are realistic — real-shape JSON, real wallet addresses, real tx hashes from Base Sepolia. I have a fixture set ready in `apps/dashboard/lib/fixtures/`.
> - **Dashboard cannot deploy to Vercel** — it polls localhost. Vercel project is configured for `apps/landing` only. Don't accidentally point it at the dashboard.
> - **Tailwind v4 is CSS-first** — `tailwind.config.ts` is dead, theme tokens go in `globals.css` via `@theme {…}`. The brief covers this.
> - **shadcn ships with its own color tokens** — override them once in `components/ui/*` to point at our variables, then never touch again.
>
> Compensation: <fill in — % of prize pool if we place, flat fee, etc.>
>
> If you're in, fork/clone, set up, and ping me. I'll send you the asciinema cast and demo video for the landing once you're at that stage. First check-in: end of day 2, "the shell renders and tokens work."
>
> Anything that's wrong or impossible — say so before doing it. I'd rather hear "this constraint breaks X" than discover it in review.
>
> Thanks for taking this on 🙏
>
> — Tim

---

## Part 2 — Repo init steps (do this BEFORE sending the DM)

### Step 1 — Create the monorepo root

```bash
mkdir quartermaster && cd quartermaster
git init
echo "node_modules\n.next\n.turbo\n.env\n.env.*\n!.env.example\ndist\nbuild\n.DS_Store\n*.log\ncoverage\n.vercel\n" > .gitignore
```

### Step 2 — pnpm workspace

```bash
# package.json (root)
cat > package.json <<'EOF'
{
  "name": "quartermaster",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev:landing": "pnpm --filter landing dev",
    "dev:dashboard": "pnpm --filter dashboard dev",
    "build:landing": "pnpm --filter landing build",
    "build:dashboard": "pnpm --filter dashboard build",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck"
  },
  "engines": {
    "node": ">=22"
  }
}
EOF

# pnpm-workspace.yaml
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF

# Verify pnpm version
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

### Step 3 — Create the two Next apps

```bash
mkdir -p apps && cd apps

# Latest Next includes all CVE patches as of today; verify version after install
pnpm create next-app@latest landing \
  --typescript --tailwind --app --src-dir=false --import-alias="@/*" --no-eslint --use-pnpm --turbopack

pnpm create next-app@latest dashboard \
  --typescript --tailwind --app --src-dir=false --import-alias="@/*" --no-eslint --use-pnpm --turbopack

cd ..

# Verify versions and pin them — replace exact strings below with what was actually installed
cd apps/landing && pnpm list next react react-dom && cd ../..
cd apps/dashboard && pnpm list next react react-dom && cd ../..
```

After install, open both `apps/*/package.json` files and **pin exact versions** (remove `^`):

```jsonc
{
  "dependencies": {
    "next": "16.2.2",        // or whatever the install gave you
    "react": "19.2.4",       // CRITICAL: must be 19.2.4+ for the RSC DoS fix
    "react-dom": "19.2.4"
  }
}
```

If `pnpm list` shows `react` below `19.2.4`, force-upgrade:

```bash
cd apps/landing && pnpm add react@latest react-dom@latest && cd ../..
cd apps/dashboard && pnpm add react@latest react-dom@latest && cd ../..
```

### Step 4 — Install shadcn and shared deps

```bash
# Dashboard gets the heavy deps
cd apps/dashboard
pnpm add recharts lucide-react clsx tailwind-merge zod
pnpm add -D @types/node
npx shadcn@latest init   # accept defaults; answer New York / dark default
npx shadcn@latest add button card table tabs dialog badge tooltip separator scroll-area skeleton
cd ../..

# Landing only needs lucide for the icon strip
cd apps/landing
pnpm add lucide-react clsx
cd ../..
```

### Step 5 — Shared schemas package

```bash
mkdir -p packages/shared-schemas/src

cat > packages/shared-schemas/package.json <<'EOF'
{
  "name": "@quartermaster/shared-schemas",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "^3.23.0"
  }
}
EOF

cat > packages/shared-schemas/src/index.ts <<'EOF'
// Placeholder — schemas land here in Phase 2.
export {};
EOF

# Wire to apps
cd apps/dashboard && pnpm add @quartermaster/shared-schemas@workspace:* && cd ../..
cd apps/landing && pnpm add @quartermaster/shared-schemas@workspace:* && cd ../..
```

### Step 6 — Drop the PRD and brief into the repo root

```bash
# Copy the two markdown files into the repo
cp <wherever>/MASTER_PRD_v2.md ./MASTER_PRD.md
cp <wherever>/FRONTEND_BRIEF.md ./FRONTEND_BRIEF.md
```

### Step 7 — Initial README

```bash
cat > README.md <<'EOF'
# Quartermaster

Treasury layer for the agent economy. Built on Zerion CLI.

## Status

Pre-Day-0. Master PRD: see `MASTER_PRD.md`. Frontend brief: see `FRONTEND_BRIEF.md`.

## Apps

- `apps/landing` — marketing site, deploys to Vercel
- `apps/dashboard` — local-only ops UI, polls `http://127.0.0.1:7402`

## Develop

```bash
pnpm install
pnpm dev:landing      # runs on :3000
pnpm dev:dashboard    # runs on :3001
```

## License

MIT
EOF
```

### Step 8 — Set dashboard port to 3001 to avoid colliding with landing

```bash
# In apps/dashboard/package.json, change the dev script:
# "dev": "next dev --turbopack -p 3001"
```

### Step 9 — First commit + push

```bash
git add .
git commit -m "chore: monorepo init with Next 16 latest + shadcn + shared schemas"

# Create a private GitHub repo, then:
git remote add origin git@github.com:<you>/quartermaster.git
git branch -M main
git push -u origin main
```

### Step 10 — Vercel project (LANDING ONLY)

1. Go to vercel.com → Add New Project → Import the repo
2. **Critical settings:**
   - Framework Preset: **Next.js**
   - **Root Directory: `apps/landing`** (must set this — Vercel needs to know which app)
   - Build Command: leave default (`next build`)
   - Output Directory: leave default
   - Install Command: `pnpm install --frozen-lockfile`
3. Environment variables: none needed for the landing page (it's a static marketing site)
4. Deploy. Confirm the build succeeds. Confirm the URL renders the default Next.js page.
5. **Do NOT create a second Vercel project for the dashboard.** The dashboard is local-only.

### Step 11 — Add the friend as a collaborator

GitHub: Settings → Collaborators → Add `<her-handle>` with Write access (or invite to a frontend team if you're using GH Teams).

Vercel: Settings → Members → Invite `<her-email>` with Member role for the team.

### Step 12 — Provide her the fixture data

Before her first dashboard work, you'll need a fixture set she can develop against. Drop these placeholders now so she's not blocked:

```bash
mkdir -p apps/dashboard/lib/fixtures

cat > apps/dashboard/lib/fixtures/state.json <<'EOF'
{
  "fleet": {
    "totalWallets": 5,
    "totalFloatUsdc": 42.30,
    "minRunwayHours": 14,
    "aggregateBurnUsdcPerHour": 1.23
  },
  "treasury": {
    "totalValueUsd": 8420.17,
    "sourceCount": 3,
    "weightedApy": 0.048
  },
  "actions24h": {
    "topupsCount": 12,
    "blockedCount": 0,
    "errorsCount": 0,
    "totalUsdMoved": 124.00
  }
}
EOF
```

(You'll generate fuller fixtures in Phase 2 once the schemas are real. This is a skeleton so the frontend dev can wire something visible on day 1.)

### Step 13 — Verify everything works

```bash
pnpm install
pnpm dev:landing      # browse to localhost:3000
pnpm dev:dashboard    # browse to localhost:3001
```

Both should render the default Next.js page. Vercel preview URL should also work.

If they do — push the fixture, send the DM. You're handed off.

---

## Part 3 — A note for you, Tim

While she works on frontend, you're free to:
- Run Day 0 verification per PRD §27
- Begin Phase 1 — fork zerion-ai into `cli/`
- Set up `docs-verified/` with the snapshot protocol
- Get your principal wallet + agent token + Base Sepolia fixtures ready

The frontend track and the CLI/daemon track are mostly independent until Phase 4–5 when the daemon HTTP API needs to match what she's already built against the fixtures. Keep `packages/shared-schemas/` in sync as the source of truth — when you change a schema, ping her.

If she finishes early, the natural extension work is: README polish on the GitHub side, asciinema cast generation (you'll need to record it; she can wire the embed), and demo video editing.

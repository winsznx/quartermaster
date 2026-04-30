# cli/

**Empty until Phase 1.** This directory will hold the forked `zerion-ai` CLI plus our `qm/` extensions.

Per `MASTER_PRD.md` §22.1 the layout will be:

```
cli/
├── (upstream zerion-ai files)
├── commands/fleet/
├── commands/treasury/
├── commands/qm/
├── lib/qm/
├── lib/fleet/
├── lib/treasury/
└── policies/
    ├── (upstream)
    ├── max-per-action-cap.mjs
    ├── cooldown-window.mjs
    ├── burn-rate-oracle.mjs
    └── yield-curve-preservation.mjs
```

Phase 1 begins with `git remote add upstream <zerion-ai>` and a clean fork.

Until then this directory is a placeholder so the workspace path resolves.

# docs-verified/

Snapshots of upstream documentation, frozen at the moment they were verified, with the source URL and timestamp recorded. The PRD references these files instead of live URLs so the build is reproducible even if upstream docs change mid-hackathon.

Per `MASTER_PRD.md` §0.2 and §27 (Day 0 Gate), the following snapshots are required before Phase 1:

| File | Source | Purpose |
|---|---|---|
| `zerion-cli.md` | https://github.com/zerion-cli (or wherever it lives) | CLI surface we're forking |
| `zerion-api.md` | https://api.zerion.io reference | Data shapes we depend on |
| `x402.md` | x402 spec / Coinbase facilitator docs | Payment protocol contract |

Each snapshot file should begin with a metadata block:

```markdown
---
source: <url>
verified_at: <ISO-8601 UTC>
verified_by: <name>
upstream_commit: <git sha if applicable>
---
```

Drift between snapshot and upstream is logged in `DEVIATIONS.md`.

Day 0 verification fills these in. Until then this directory is empty except for `DEVIATIONS.md`.

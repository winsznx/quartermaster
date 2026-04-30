# scripts/

Operational scripts used during the build, demo prep, and Day-0 verification.

Per `MASTER_PRD.md` §22.1 this directory holds:

- `demo-setup.mjs` — seeds the local fleet for the demo recording
- `verify-docs.mjs` — checks `docs-verified/` against upstream and flags drift
- `seed-testnet.mjs` — funds the demo wallets on Base Sepolia

These land during the build phases. Until then this directory is empty.

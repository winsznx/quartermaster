# Quartermaster — operator bootstrap

These commands are what you (the operator) run **once**, in your terminal, before the daemon can do live e2e on Base or Base Sepolia. The Quartermaster CLI agent (Claude / next session) drives the rest.

This is the **only** procedure that requires a real interactive terminal — `wallet import` / `wallet create` / `agent create-token` all prompt for input that an automated agent can't safely drive.

---

## Prerequisite

`.env.local` must exist at the repo root with at minimum:

```
ZERION_API_KEY=zk_dev_...
```

(Get a key at <https://dashboard.zerion.io>. The `WALLET_PRIVATE_KEY` and `ZERION_AGENT_TOKEN` keys in your existing `.env.local` are **not** read by upstream's CLI — upstream stores its agent token in `~/.zerion/config.json`, populated by `zerion agent create-token` below.)

You should already have:
- One funded wallet on the target chain (Base mainnet OR Base Sepolia). For Sepolia: USDC + a small amount of ETH for gas. ~80 USDC + 0.01 ETH is plenty for the demo.
- The funded wallet's private key (you'll paste it interactively in step 2).

---

## 1. Source the env so the CLI sees the API key

The CLI is spawned as `npx zerion ...` — a child process — and Next.js auto-loaders don't apply. Source the file in your shell:

```bash
cd /path/to/quartermaster
set -a; source .env.local; set +a
echo $ZERION_API_KEY  # should print zk_dev_...
```

Once the daemon (`zerion qm run`) starts, it loads `.env.local` itself and passes the key to subprocesses. **You only need to source manually for the bootstrap commands below**, which run before the daemon.

---

## 2. Import the funded principal into upstream's keystore

```bash
node cli/cli/zerion.js wallet import --name principal --evm-key
```

This will prompt:
1. **Private key** — paste the hex private key (with or without `0x` prefix) for the funded wallet, then Enter.
2. **Passphrase** — set a strong passphrase for the keystore. **Remember it** — you'll be prompted for it on every signing operation.
3. **Confirm passphrase** — re-enter.

Verify:

```bash
node cli/cli/zerion.js wallet list --pretty
```

You should see one wallet named `principal` with the EVM address matching your funded wallet.

---

## 3. Create three subordinate wallets

```bash
for i in 1 2 3; do
  node cli/cli/zerion.js wallet create --name alpha-$i
done
```

Each invocation prompts:
1. **Passphrase** — same passphrase as step 2 if you want a single passphrase across all wallets, or a different one per wallet.
2. **Confirm passphrase**.

Output JSON includes the new EVM address for each.

Verify:

```bash
node cli/cli/zerion.js wallet list --pretty
# Should show: principal, alpha-1, alpha-2, alpha-3
```

---

## 4. Mint the agent token (scoped to base + base-sepolia)

The agent token is what the daemon-spawned `npx zerion send/swap` subprocesses use to sign without prompting for the passphrase each time. Scope it tightly to the chains we use plus an allowlist of expected destinations.

For **Base Sepolia demo** (preferred for hackathon, no real money):

```bash
node cli/cli/zerion.js agent create-token \
  --name qm-bot \
  --wallet principal \
  --chains base,base-sepolia \
  --deny-approvals \
  --deny-transfers
```

For **Base mainnet** (only if you intentionally want real-money e2e):

```bash
node cli/cli/zerion.js agent create-token \
  --name qm-bot \
  --wallet principal \
  --chains base \
  --deny-approvals \
  --deny-transfers
```

Note: `--chains base-sepolia` only works after the daemon-loaded chain registry patch is active (`QM_ENABLE_BASE_SEPOLIA=1`). The daemon sets this automatically. For this manual `agent create-token` invocation, prefix the command:

```bash
QM_ENABLE_BASE_SEPOLIA=1 node cli/cli/zerion.js agent create-token \
  --name qm-bot \
  --wallet principal \
  --chains base,base-sepolia \
  --deny-approvals \
  --deny-transfers
```

This will prompt:
1. **Passphrase** for the principal wallet.
2. Possibly: confirm any policy details.

Output: a token string — upstream auto-saves it to `~/.zerion/config.json` under `agentToken`. **You don't need to copy it anywhere.**

Verify:

```bash
node cli/cli/zerion.js config list
# Should show agentToken: ****
```

---

## 5. Capture the addresses

```bash
node cli/cli/zerion.js wallet list --pretty | head -40
```

Note down (you'll send these to the agent):
- `principal` EVM address
- `alpha-1` EVM address
- `alpha-2` EVM address
- `alpha-3` EVM address

---

## 6. Fund subordinates from principal (real on-chain transfers)

The daemon needs each subordinate to have a starter USDC balance so the watcher can observe burn. ~5 USDC each is plenty.

For Base Sepolia (cheaper — testnet USDC):

```bash
QM_ENABLE_BASE_SEPOLIA=1 node cli/cli/zerion.js send <alpha-1-address> USDC 5 --wallet principal --chain base-sepolia
QM_ENABLE_BASE_SEPOLIA=1 node cli/cli/zerion.js send <alpha-2-address> USDC 5 --wallet principal --chain base-sepolia
QM_ENABLE_BASE_SEPOLIA=1 node cli/cli/zerion.js send <alpha-3-address> USDC 5 --wallet principal --chain base-sepolia
```

For Base mainnet, drop `QM_ENABLE_BASE_SEPOLIA=1` and use `--chain base`.

Each invocation prompts the principal's passphrase once, then signs + broadcasts. Output JSON includes the tx hash. Verify on Basescan: `https://sepolia.basescan.org/tx/<hash>` for Sepolia.

You'll also need to send each subordinate a small amount of native ETH for gas (so they can sign the burn-loop transfers in step 8 of the operator → agent handoff). Roughly 0.001 ETH per subordinate is enough for 30+ sends.

```bash
# Native ETH transfer — same `send` command, asset = "ETH" or "native"
QM_ENABLE_BASE_SEPOLIA=1 node cli/cli/zerion.js send <alpha-1-address> ETH 0.002 --wallet principal --chain base-sepolia
# repeat for alpha-2, alpha-3
```

---

## 7. Verify-it-worked checklist

Before you message the agent, confirm:

- [ ] `node cli/cli/zerion.js wallet list --pretty` shows **4 wallets**: principal, alpha-1, alpha-2, alpha-3
- [ ] `~/.zerion/config.json` exists and contains an `agentToken` field
- [ ] `node cli/cli/zerion.js config list` shows the agent token (redacted)
- [ ] Each subordinate's funding tx is visible on Basescan
- [ ] Each subordinate has ~5 USDC + ~0.002 ETH on the chosen chain
- [ ] Principal still has at least 50 USDC + 0.005 ETH for the daemon's later top-up cycles

---

## 8. What to send the agent

Reply to the agent with:

```
principal:  0x<paste-real-address>
alpha-1:    0x<paste-real-address>
alpha-2:    0x<paste-real-address>
alpha-3:    0x<paste-real-address>
chain:      base-sepolia       (or "base" for mainnet)
keystore:   names match fleet ids (alpha-1 keystore = alpha-1 fleet entry)
agent-token-active: yes
funded:     each subordinate ~5 USDC + ~0.002 ETH; principal ~60 USDC + ~0.01 ETH
```

The agent will then:
1. Register the fleet (`zerion fleet add alpha-N <addr>` ×3)
2. Register the treasury source (`zerion treasury add principal-usdc <principal-addr>`)
3. Tighten policy thresholds for demo timing (`zerion qm policy set` — short cooldown, low minRunwayHours)
4. Start the daemon (`zerion qm run` in background)
5. Trigger happy-path on alpha-1 (`zerion qm test spike --wallet=alpha-1 --rate=20 --duration=180 --to=<burn-address>`)
6. Trigger J1 on alpha-2 (`zerion qm test spike --wallet=alpha-2 --rate=1000 --duration=60 --to=<burn-address>`)
7. Capture all tx hashes for README §26.4
8. Verify reconcile by killing the daemon mid-cycle and restarting

---

## Phase 7a re-run — one-shot driver

Reproducing the README §26.4 Phase 7a evidence is one command. The driver script handles daemon lifecycle, both x402-burn legs, ledger polling for top-up/block resolution, on-chain settlement scraping, and writes a results JSON.

**Prerequisites** (same as full bootstrap above):
- keystore + agent tokens + fleet registered (steps 1–6)
- daemon NOT already running
- `principal` ≥ $1 USDC + ~$0.0002 ETH gas
- Each subordinate ≥ $0.10 USDC + a tiny bit of ETH
- `QM_KEYSTORE_PASSPHRASE` available — wherever you stored the bootstrap passphrase

**Run:**

```bash
QM_KEYSTORE_PASSPHRASE='<your passphrase>' node scripts/run-phase7a.mjs
```

The script logs progress every minute. Total wall time ~9 minutes. When it returns:
- `scripts/phase7a-results.json` has every captured event (top-up actionIds, block reasonTexts, settlement hashes)
- `scripts/phase7a-daemon.log` has the daemon's full stdout/stderr for that run
- daemon is stopped, lock cleared

**Check results:**

```bash
jq '.legA_alpha1Burn.topUp.txHash, .legB_alpha2Spike.block.reasonText' scripts/phase7a-results.json
```

**If you need to re-run** (the script is idempotent except for the on-chain side-effects): make sure no `~/.zerion/quartermaster/.lock` lingers, principal is still funded, then re-invoke. Each run produces a fresh `phase7a-results.json` (overwrites prior).

**Safety:** the script never logs the passphrase. The driver runs subprocesses with the env scoped to that subprocess only — it doesn't write the passphrase anywhere on disk. Once your shell session ends, the env var is gone.

---

## Troubleshooting

**`missing_api_key` from any subcommand** — you didn't `source .env.local`. Re-run step 1.

**`Unsupported chain 'base-sepolia'`** — the chain registry patch isn't active in this process. Prefix the command with `QM_ENABLE_BASE_SEPOLIA=1`.

**`unknown_command: wallet import`** — you ran `zerion wallet import` instead of `node cli/cli/zerion.js wallet import`. Use the latter for now (a global `zerion` install hasn't been published).

**Insufficient gas** on a subordinate's burn-loop send — increase the native ETH funding in step 6.

**Transaction stuck pending** on Sepolia — Sepolia mempool can be slow. Wait or accept the chain failure; the daemon will surface it as a `daemon_halt` ledger event when reconciling.

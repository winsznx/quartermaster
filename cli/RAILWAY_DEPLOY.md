# Railway deployment — public Quartermaster daemon

This is the operator runbook for deploying the daemon to Railway so the
Vercel-hosted dashboard can poll a public URL. ~30 minutes end-to-end if
you've already completed the Phase 4.6 + 7a local bootstrap; longer if
this is your first time on Railway.

> **What you get:** a public URL like `https://quartermaster-daemon-production.up.railway.app/api/state` that judges can browse without cloning. The daemon's signing code is unchanged — it just happens to run on Railway now.

---

## Prerequisites

- **Local `~/.zerion/` from your Phase 4.6 + 7a runs.** Specifically the
  keystore + agent-token config + `quartermaster/{fleet.json,treasury.json}`.
  The Railway daemon will resume from this state.
- **The bootstrap passphrase** (the one in `/tmp/qm-passphrase.txt` from
  the Phase 4.6 autonomous bootstrap, or whatever you set during
  `wallet create`).
- **Your `ZERION_API_KEY`** from `.env.local`.
- **Railway account** + the [Railway CLI](https://docs.railway.app/develop/cli)
  installed: `npm i -g @railway/cli`.
- **Funded principal wallet** with enough USDC + ETH for the live
  orchestrator's monthly burn budget (default $5 USDC + ~$0.01 ETH gas).

---

## 1. Login + project init

```bash
railway login                                  # browser auth flow
cd /path/to/quartermaster
railway init                                   # pick "Create new project"
                                                # name it (e.g., "quartermaster-daemon")
```

This creates `.railway/` in your repo root (already in `.gitignore`).

## 2. Add the service from this repo

```bash
railway link                                   # link this dir to the new project
railway service create quartermaster-daemon    # creates the service container
```

Use Railway's dashboard (Settings → Source) to point the service at this
GitHub repo + branch (`main`). Build settings:

- **Root directory:** `/` (default)
- **Builder:** Nixpacks (Railway's default — auto-detects Node 22)
- **Start command:** `node cli/cli/zerion.js qm run`
- **Watch paths:** `cli/**`, `packages/shared-schemas/**` (re-deploy on backend changes only)

## 3. Configure env vars

In Railway dashboard → Variables, set:

| Variable | Value | Purpose |
|---|---|---|
| `PORT` | _(auto-injected by Railway)_ | Daemon binds here |
| `QM_PUBLIC` | `1` | Enables 0.0.0.0 binding + live orchestrator |
| `QM_CORS_ORIGINS` | `https://quartermaster-landing.vercel.app,https://quartermaster-dashboard.vercel.app` | Browser allow-list. Adjust to your actual Vercel URLs. |
| `QM_KEYSTORE_PASSPHRASE` | _(your bootstrap passphrase)_ | Unlocks principal + subordinate keystores. **Mark as secret in Railway.** |
| `ZERION_API_KEY` | _(from `.env.local`)_ | Read-only Zerion API access |
| `WALLET_PRIVATE_KEY` | _(principal's key from `.env.local`)_ | Required for `--x402` mode the live orchestrator triggers. **Mark as secret.** |
| `QM_LIVE_BURN_INTERVAL_MIN` | `15` _(default)_ | Min minutes between orchestrator burns when no other activity |
| `QM_LIVE_BURN_BUDGET_USDC` | `5` _(default)_ | Hard monthly cap; daemon refuses to orchestrate beyond this |
| `QM_LIVE_MIN_SUBORDINATE_USDC` | `0.10` _(default)_ | Skip orchestration if any subordinate is below this floor |

**Security:** never paste these into chat tools. Pull values directly
from your local `.env.local` + `/tmp/qm-passphrase.txt` and paste into
Railway's secret-fields UI.

## 4. Mount a persistent volume at `/data`

Railway → service → Volumes → "New volume":

- **Mount path:** `/data`
- **Size:** 1 GB (the daemon's state directory is < 10 MB; 1 GB is the smallest option)

The daemon detects the Railway runtime and writes to `/data/quartermaster/`
automatically (see [`cli/lib/qm/storage.js`](lib/qm/storage.js) `resolveQmHome`).

## 5. Seed the volume with your local state

The daemon needs your bootstrapped `~/.zerion/` to function — fleet.json,
treasury.json, OWS keystore, agent-token config. Tarball it, then push
to the volume:

```bash
# From your local machine:
tar -czf /tmp/qm-state.tgz -C ~/.zerion/ . \
  && echo "Staged $(stat -f%z /tmp/qm-state.tgz) bytes for upload"

# Verify the tarball contents (should be < 1 MB; flag anything unexpected):
tar -tzf /tmp/qm-state.tgz | head

# Push via Railway CLI (works on Railway projects with a volume attached):
railway run -- bash -c 'mkdir -p /data && tar -xzf - -C /data' < /tmp/qm-state.tgz
```

Alternative if `railway run` doesn't accept stdin: open Railway → service →
Shell, then in your local shell run `cat /tmp/qm-state.tgz | base64 |
pbcopy`, paste into Railway's shell as `echo '<base64>' | base64 -d |
tar -xzf - -C /data`.

After upload, verify in the Railway shell:

```bash
ls /data/                      # config.json, quartermaster/
cat /data/quartermaster/fleet.json | jq 'length'   # should print 3
ls /data/quartermaster/        # fleet.json, treasury.json, ledger.jsonl, samples.jsonl
```

> **Why we copy the keystore** — re-bootstrapping on Railway would generate
> fresh wallets that aren't funded. The whole point of Phase 8 is to expose
> your already-funded, already-working local daemon as a public service.

## 6. Deploy

```bash
railway up                                     # uploads + builds + boots
```

Or push to `main` if you wired GitHub deploys in step 2.

Watch the deploy logs:

```bash
railway logs                                   # streams stdout
```

Expected boot sequence (first 20 lines):

```
{"envLoaded":{"path":"/app/.env.local","keys":[...]}}    # may be absent on Railway; not required
{"qmHome":{"root":"/data/quartermaster","source":"railway_volume"}}
{"daemonStarted":true,"pid":1,"port":7402,"hostname":"0.0.0.0","tickSeconds":60,"publicMode":true,"corsOrigins":["http://127.0.0.1:3001","http://localhost:3001","https://quartermaster-landing.vercel.app","https://quartermaster-dashboard.vercel.app"]}
```

Note: Railway sets `PORT` automatically; the daemon honors it. The
`hostname:"0.0.0.0"` line confirms public-binding mode is on.

## 7. Configure the Railway healthcheck

Railway → service → Settings → Healthcheck:

- **Path:** `/api/health`
- **Port:** _(matches `PORT` — Railway auto-fills)_
- **Timeout:** 5s
- **Interval:** 30s

The endpoint returns `{ status, version, uptimeSec, fleetSize, lastTickAt, publicMode, liveOrchestrator }`. Healthy iff `fleetSize > 0`.

## 8. Capture the public URL

Railway → service → Settings → Networking → "Generate domain". You get
something like:

```
https://quartermaster-daemon-production.up.railway.app
```

Verify it works:

```bash
curl https://<your-domain>/api/health | jq
```

Expected:

```json
{
  "status": "ok",
  "daemonPid": 1,
  "startedAt": "2026-05-09T...",
  "version": "0.0.0-phase4",
  "uptimeSec": 42,
  "fleetSize": 3,
  "lastTickAt": "2026-05-09T...",
  "publicMode": true,
  "liveOrchestrator": {
    "enabled": true,
    "monthlyBudgetUsdc": 5,
    "monthlySpentUsdc": 0,
    "budgetExhausted": false,
    "lastDecision": null
  }
}
```

## 9. Wire the dashboard to the public daemon

In Vercel → dashboard project → Settings → Environment Variables:

```
NEXT_PUBLIC_DAEMON_URL = https://<your-railway-domain>
```

Trigger a redeploy (Vercel → Deployments → "Redeploy"). Once the new
build lands:

- The dashboard's status pill renders a `Deployed` badge
- The offline panel (when daemon hiccups) shows the "Service interruption"
  copy variant instead of the local-host bootstrap walkthrough
- All `/api/*` calls hit the Railway URL directly

---

## Troubleshooting

### CORS errors in the dashboard browser console

The browser requests preflight `OPTIONS` from the Railway URL with
`Origin: https://quartermaster-dashboard.vercel.app`. The daemon
responds with `Access-Control-Allow-Origin` only if that origin is in
`QM_CORS_ORIGINS`. Symptom: dashboard shows "Service interruption"
despite `/api/health` returning 200 in `curl`.

**Fix:** double-check `QM_CORS_ORIGINS` in Railway env vars matches the
exact Vercel URL the browser loads (no trailing slash, https not http,
`vercel.app` not `vercel.dev`). Restart the service after editing.

### Volume not persisting state across deploys

If `/data/quartermaster/fleet.json` disappears on redeploy, the volume
isn't actually mounted at `/data`. Symptoms in the daemon log: `qmHome`
source is `railway_volume` but `fleet.json` is empty / missing.

**Fix:** Railway dashboard → service → Volumes → confirm mount path is
exactly `/data` (not `/data/` or `/var/data`). Re-run step 5 to seed.

### `missing_passphrase` or `target_wallet_not_in_fleet` errors

The daemon spawned but can't decrypt the keystore.

**Fix:** verify `QM_KEYSTORE_PASSPHRASE` is set as a Railway env var
(not a build-time variable). It should be marked secret. Restart the
service after adding it.

### Live orchestrator never fires

`/api/health` shows `liveOrchestrator.lastDecision = null` after several
ticks.

**Fix:** the orchestrator runs in `runOneTick`. Check daemon logs for
`tick_completed` events. If those are present but no `live_orchestrator_tick`
events appear, `QM_PUBLIC` is probably not `1` — public mode is the gate.
If `live_orchestrator_tick` events appear with `decision: skipped_passphrase_missing`,
the passphrase var isn't in the runtime env (see prior troubleshooting item).

### Monthly budget exhausted earlier than expected

`/api/health` shows `liveOrchestrator.budgetExhausted = true` partway
through the month.

**Fix:** the budget is a hard cap by design. Either:
- Wait until the calendar month rolls over (UTC-based reset)
- Increase `QM_LIVE_BURN_BUDGET_USDC` and restart the service

### Cold-start timeouts on first hit after idle

Railway scales the container to zero on inactivity (free tier). First hit
takes ~15s to boot. The dashboard's offline panel shows "Service
interruption — try again in a minute" during the boot window. Refresh
once you see the boot log.

**Fix (optional):** upgrade the Railway plan to keep the container warm,
or accept the cold-start as a feature (it bounds the daemon's hosting cost).

---

## Cost expectations

- **Railway hobby tier**: $5/mo flat + $0.000231/GB-RAM-hour. The daemon's
  RAM footprint is ~80 MB; ~$1/mo for 24/7 runtime.
- **Live orchestrator burns**: capped at `QM_LIVE_BURN_BUDGET_USDC` (default
  $5/mo). Real on-chain USDC, paid from `principal` to the x402 facilitator.
- **Total**: ~$6/mo for the public demo. Stop the service to halt all
  costs (state preserved on the volume).

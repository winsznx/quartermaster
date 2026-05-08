#!/usr/bin/env node
/**
 * One-shot Phase 7a driver — runs the full subordinate-burn + daemon-top-up
 * + spike-block sequence end-to-end, captures every hash, writes a results
 * JSON the operator can paste into README §26.4.
 *
 * Why a script (not a doc): the BOOTSTRAP.md "Phase 7a re-run" walkthrough
 * has 8 manual steps with `tail -f` and Ctrl-C in the middle. Easy to
 * mistime, easy to leave the daemon running, easy to skip the grep at the
 * end. This script does all of it deterministically in ~5 minutes.
 *
 * Operator runs:
 *
 *   QM_KEYSTORE_PASSPHRASE='<your passphrase>' node scripts/run-phase7a.mjs
 *
 * That's the whole interaction. Walk away. When it returns, results land at
 * scripts/phase7a-results.json with the new top-up hash, the spike-block
 * actionId + reasonText, and the x402 settlement hashes from both burns.
 *
 * Requires: keystore already bootstrapped (see cli/BOOTSTRAP.md), .env.local
 * present at repo root, fleet + treasury already registered, daemon NOT
 * already running, principal funded with at least $1 USDC + 0.0002 ETH on
 * Base mainnet.
 *
 * Phase 7a recovery — built 2026-05-08, paired with the sendOnlyPlan fix.
 * NOT an upstream file.
 */

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ZERION_CLI = resolve(REPO_ROOT, "cli/cli/zerion.js");
const LEDGER = resolve(process.env.HOME, ".zerion/quartermaster/ledger.jsonl");
const RESULTS = resolve(REPO_ROOT, "scripts/phase7a-results.json");
const DAEMON_LOG = resolve(REPO_ROOT, "scripts/phase7a-daemon.log");

function die(msg) {
  console.error(`phase7a: ${msg}`);
  process.exit(1);
}

function log(msg) {
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(`[${stamp}] ${msg}`);
}

// ---------- env preflight ----------

function loadEnvLocal() {
  const path = resolve(REPO_ROOT, ".env.local");
  if (!existsSync(path)) die(`.env.local not found at ${path}`);
  const env = {};
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[trimmed.slice(0, eq).trim()] = v;
  }
  return env;
}

const envFile = loadEnvLocal();
const passphrase = process.env.QM_KEYSTORE_PASSPHRASE;
if (!passphrase) die("QM_KEYSTORE_PASSPHRASE is required. Run: QM_KEYSTORE_PASSPHRASE='...' node scripts/run-phase7a.mjs");
if (!envFile.ZERION_API_KEY) die(".env.local missing ZERION_API_KEY");
if (!envFile.WALLET_PRIVATE_KEY) die(".env.local missing WALLET_PRIVATE_KEY (principal's key)");

// Subprocess env — operator's process.env wins over .env.local; passphrase
// always set; QM_ENABLE_BASE_SEPOLIA on (chain-registry patch).
const childEnv = {
  ...envFile,
  ...process.env,
  QM_KEYSTORE_PASSPHRASE: passphrase,
  QM_ENABLE_BASE_SEPOLIA: "1",
};

// ---------- ledger helpers ----------

function readLedgerSince(byteOffset) {
  if (!existsSync(LEDGER)) return { events: [], offset: 0 };
  const buf = readFileSync(LEDGER);
  const slice = buf.slice(byteOffset).toString("utf-8");
  const events = [];
  for (const line of slice.split("\n")) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch { /* truncated tail */ }
  }
  return { events, offset: buf.length };
}

async function waitForEvent(predicate, { sinceOffset, timeoutMs, label }) {
  const start = Date.now();
  let offset = sinceOffset;
  while (Date.now() - start < timeoutMs) {
    const { events, offset: nextOffset } = readLedgerSince(offset);
    offset = nextOffset;
    const match = events.find(predicate);
    if (match) return { match, finalOffset: offset };
    await sleep(2_000);
  }
  throw new Error(`timeout waiting for ${label} after ${timeoutMs}ms`);
}

function ledgerByteOffset() {
  if (!existsSync(LEDGER)) return 0;
  return readFileSync(LEDGER).length;
}

// ---------- subprocess wrappers ----------

function runZerion(args, { timeoutMs = 90_000 } = {}) {
  return new Promise((res, rej) => {
    const child = spawn("node", [ZERION_CLI, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: childEnv,
    });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rej(new Error(`zerion ${args.join(" ")}: timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout?.on("data", (b) => (stdout += b.toString()));
    child.stderr?.on("data", (b) => (stderr += b.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) rej(new Error(`zerion ${args.join(" ")}: exit ${code}; stderr=${stderr.slice(0, 300)}`));
      else res({ stdout, stderr });
    });
  });
}

let daemonChild = null;

async function startDaemon() {
  log("starting daemon (output → scripts/phase7a-daemon.log)");
  const fd = openSync(DAEMON_LOG, "w");
  daemonChild = spawn("node", [ZERION_CLI, "qm", "run"], {
    stdio: ["ignore", fd, fd],
    env: childEnv,
    detached: false,
  });
  daemonChild.on("error", (err) => log(`daemon spawn error: ${err.message}`));
  // Poll http://127.0.0.1:7402/api/state until it responds (max 30s).
  const start = Date.now();
  while (Date.now() - start < 30_000) {
    try {
      const r = await fetch("http://127.0.0.1:7402/api/state");
      if (r.ok) {
        log("daemon online");
        return;
      }
    } catch { /* not up yet */ }
    await sleep(1_500);
  }
  throw new Error("daemon did not come up within 30s — check scripts/phase7a-daemon.log");
}

async function stopDaemon() {
  if (!daemonChild) return;
  log("stopping daemon");
  daemonChild.kill("SIGTERM");
  await sleep(2_000);
  if (!daemonChild.killed) daemonChild.kill("SIGKILL");
  daemonChild = null;
}

// ---------- phase 7a sequence ----------

async function main() {
  // 0. Sanity — daemon not already running (lock file).
  const lockPath = resolve(process.env.HOME, ".zerion/quartermaster/.lock");
  if (existsSync(lockPath)) die(`.lock exists at ${lockPath} — another daemon is running. Stop it first.`);

  const results = {
    startedAt: new Date().toISOString(),
    fleetConfigSnapshot: JSON.parse(readFileSync(resolve(process.env.HOME, ".zerion/quartermaster/fleet.json"), "utf-8")),
    legA_alpha1Burn: { x402Settlements: [], topUp: null },
    legB_alpha2Spike: { x402Settlements: [], block: null },
  };

  const offsetBefore = ledgerByteOffset();

  // 1. Start daemon.
  await startDaemon();

  // 2. Drive alpha-1 normal burn — 6 calls × $0.01, ~$0.06 spent over 180s.
  log("running alpha-1 x402-burn (rate=2/min, duration=180s — 6 x402 calls expected)");
  try {
    const { stdout } = await runZerion(
      ["qm", "test", "x402-burn", "--wallet=alpha-1", "--rate=2", "--duration=180"],
      { timeoutMs: 360_000 },
    );
    // Capture per-call output for accountability.
    results.legA_alpha1Burn.commandOutput = stdout.slice(-2000);
  } catch (err) {
    log(`alpha-1 burn errored: ${err.message}`);
    results.legA_alpha1Burn.error = err.message;
  }

  // 3. Wait up to 3 ticks (~3 min) for daemon to detect alpha-1's runway
  //    crossing 0.5h, plan top-up, run policies, execute send.
  log("waiting up to 180s for daemon to plan + confirm alpha-1 top-up");
  try {
    const { match, finalOffset } = await waitForEvent(
      (e) => e.type === "topup_send_confirmed" || e.type === "topup_aborted_no_source" || (e.type === "topup_blocked" && /alpha-1/.test(JSON.stringify(e))),
      { sinceOffset: offsetBefore, timeoutMs: 200_000, label: "alpha-1 top-up resolution" },
    );
    results.legA_alpha1Burn.topUp = match;
    log(`alpha-1 top-up resolved as ${match.type}: actionId=${match.actionId ?? "n/a"} txHash=${match.txHash ?? "n/a"}`);
  } catch (err) {
    log(`alpha-1 top-up wait failed: ${err.message}`);
    results.legA_alpha1Burn.topUpError = err.message;
  }

  const offsetMid = ledgerByteOffset();

  // 4. Drive alpha-2 spike — fast burn to trigger BURN_RATE_ANOMALY_DETECTED.
  //    rate=30/min × 60s = 30 calls × $0.01 = up to $0.30, but alpha-2 has
  //    ~$0.133 so it'll exhaust around iteration 13. The exhaustion is fine —
  //    facilitator returns insufficient-funds, x402-burn logs it, the spike
  //    has already happened.
  log("running alpha-2 x402-burn (rate=30/min, duration=60s — spike pattern, will exhaust mid-burn)");
  try {
    const { stdout } = await runZerion(
      ["qm", "test", "x402-burn", "--wallet=alpha-2", "--rate=30", "--duration=60"],
      { timeoutMs: 180_000 },
    );
    results.legB_alpha2Spike.commandOutput = stdout.slice(-2000);
  } catch (err) {
    log(`alpha-2 spike errored (often expected — wallet exhausts mid-burn): ${err.message}`);
    results.legB_alpha2Spike.error = err.message;
  }

  // 5. Wait for daemon to plan + block alpha-2 top-up.
  log("waiting up to 180s for daemon to plan + block alpha-2 top-up with BURN_RATE_ANOMALY");
  try {
    const { match } = await waitForEvent(
      (e) => e.type === "topup_blocked" && /alpha-2/.test(JSON.stringify(e)),
      { sinceOffset: offsetMid, timeoutMs: 200_000, label: "alpha-2 burn-rate block" },
    );
    results.legB_alpha2Spike.block = match;
    log(`alpha-2 block captured: actionId=${match.actionId} reasonCode=${match.reasonCode}`);
  } catch (err) {
    log(`alpha-2 block wait failed: ${err.message}`);
    results.legB_alpha2Spike.blockError = err.message;
  }

  // 6. Stop daemon.
  await stopDaemon();

  // 7. Pull x402 settlement hashes for both wallets from Base RPC.
  for (const [legKey, walletAddr] of [
    ["legA_alpha1Burn", "0xc01a20033523086467cc96ea42c27c99e4fe243f"],
    ["legB_alpha2Spike", "0x551a944c805ffe1e95d2bf728a6559dee50b1c50"],
  ]) {
    log(`fetching x402 settlements for ${legKey}…`);
    try {
      const settlements = await fetchX402Settlements(walletAddr, results.startedAt);
      results[legKey].x402Settlements = settlements;
      log(`${legKey}: ${settlements.length} x402 settlement(s)`);
    } catch (err) {
      results[legKey].settlementsError = err.message;
    }
  }

  results.completedAt = new Date().toISOString();
  writeFileSync(RESULTS, JSON.stringify(results, null, 2));
  log(`results written to ${RESULTS}`);
  log(`daemon log: ${DAEMON_LOG}`);
}

// ---------- x402 settlement fetch via direct Base RPC ----------

const BASE_RPC = "https://mainnet.base.org";
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const X402_FACILITATOR = "0xd07c06a650a88bbcf4f0c4fbf2c6c08c9a60acc6";

async function rpc(method, params) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const r = await fetch(BASE_RPC, { method: "POST", headers: { "content-type": "application/json" }, body });
  const j = await r.json();
  if (j.error) throw new Error(`rpc ${method}: ${j.error.message}`);
  return j.result;
}

async function fetchX402Settlements(walletAddr, sinceISO) {
  const latestBlock = parseInt(await rpc("eth_blockNumber", []), 16);
  // Look back ~30 minutes (Base = 2s blocks → 900 blocks).
  const fromBlock = "0x" + (latestBlock - 900).toString(16);
  const fromTopic = "0x" + walletAddr.toLowerCase().replace("0x", "").padStart(64, "0");
  const logs = await rpc("eth_getLogs", [{
    address: USDC_BASE,
    fromBlock,
    toBlock: "latest",
    topics: [TRANSFER_TOPIC, [fromTopic]],
  }]);
  return logs
    .filter((l) => "0x" + l.topics[2].slice(-40) === X402_FACILITATOR)
    .map((l) => ({
      block: parseInt(l.blockNumber, 16),
      txHash: l.transactionHash,
      amountUsdc: parseInt(l.data, 16) / 1_000_000,
    }));
}

main().catch(async (err) => {
  console.error("phase7a: fatal", err);
  await stopDaemon();
  process.exit(1);
});

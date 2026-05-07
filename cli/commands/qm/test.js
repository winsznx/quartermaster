/**
 * `zerion qm test spike --wallet=<id> --rate=<usdc-per-hour>
 *                       [--duration=<seconds>] --to=<address>`
 *
 * Drains the subordinate wallet at the specified rate via REAL Sepolia USDC
 * transfers from the subordinate wallet's keystore. The watcher reads the
 * resulting balance drops via `npx zerion positions`, derives the EWMA, and
 * the layer-1 burn-rate-oracle policy refuses to top it back up because the
 * spike exceeds 10× the 7-day baseline.
 *
 * No injected samples. No fake balances. The subordinate wallet must already
 * be in upstream's keystore under the same name as its fleet id (operator
 * runs `zerion wallet import --name <id> --evm-key` per subordinate during
 * demo setup).
 *
 * Each iteration spawns `npx zerion send <to> USDC <amount> --wallet=<id>`
 * — a real on-chain Sepolia transaction. Tx hashes stream to stdout as
 * each send confirms. Operator can Ctrl-C any time; partial drains are
 * safe (real chain state is the source of truth).
 *
 * NOT an upstream command. PRD §22.1 / §31.5.
 */

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { print, printError } from "../../cli/lib/util/output.js";

import { buildSubprocessEnv } from "../../lib/qm/env.js";
import { getWallet } from "../../lib/fleet/registry.js";

const ZERION_CLI = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../cli/zerion.js",
);

const SEND_INTERVAL_MS = 10_000; // every 10s
const SEND_TIMEOUT_MS = 60_000;
const DEFAULT_DURATION_SEC = 300;

function runZerionSend({ walletId, to, amount }) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "node",
      [ZERION_CLI, "send", "USDC", String(amount), "--to", to, "--wallet", walletId, "--chain", "base"],
      { stdio: ["ignore", "pipe", "pipe"], env: buildSubprocessEnv() },
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        Object.assign(new Error(`zerion send: timeout after ${SEND_TIMEOUT_MS}ms`), {
          code: "subprocess_timeout",
        }),
      );
    }, SEND_TIMEOUT_MS);
    child.stdout?.on("data", (b) => (stdout += b.toString()));
    child.stderr?.on("data", (b) => (stderr += b.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      if (exitCode !== 0) {
        return reject(
          Object.assign(new Error(`zerion send: exit ${exitCode}; stderr=${stderr.slice(0, 200)}`), {
            code: "subprocess_exit",
          }),
        );
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(
          Object.assign(new Error(`zerion send: non-JSON stdout (${err.message})`), {
            code: "subprocess_parse",
          }),
        );
      }
    });
  });
}

function pickTxHash(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  return (
    parsed.txHash ??
    parsed.transactionHash ??
    parsed.tx?.hash ??
    parsed.transaction?.hash ??
    null
  );
}

export default async function qmTest(args, flags) {
  const [subcommand] = args;

  if (subcommand !== "spike") {
    printError(
      "unknown_subcommand",
      `unknown qm test subcommand "${subcommand}". Available: spike`,
    );
    process.exit(1);
  }

  const walletId = flags.wallet;
  const rate = Number(flags.rate);
  const duration = Number(flags.duration ?? DEFAULT_DURATION_SEC);
  const to = flags.to;

  if (!walletId || Number.isNaN(rate) || rate <= 0 || !to) {
    printError(
      "missing_args",
      "Usage: zerion qm test spike --wallet=<id> --rate=<usdc-per-hour> --to=<address> [--duration=<seconds>]",
    );
    process.exit(1);
  }

  const wallet = getWallet(walletId);
  if (!wallet) {
    printError("not_found", `wallet "${walletId}" not in fleet — register with "zerion fleet add" first`);
    process.exit(1);
  }

  // Per-iteration USDC: rate (USDC/h) × intervalMs / 3600000.
  const sendAmount = (rate * SEND_INTERVAL_MS) / 3_600_000;
  const numSends = Math.max(1, Math.floor((duration * 1000) / SEND_INTERVAL_MS));

  print({
    spike: {
      walletId,
      to,
      ratePerHour: rate,
      durationSec: duration,
      sendIntervalSec: SEND_INTERVAL_MS / 1000,
      sendAmountUsdc: sendAmount,
      plannedSends: numSends,
    },
  });

  const sent = [];
  for (let i = 0; i < numSends; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, SEND_INTERVAL_MS));
    try {
      const response = await runZerionSend({ walletId, to, amount: sendAmount });
      const txHash = pickTxHash(response);
      sent.push({ i: i + 1, txHash, amountUsdc: sendAmount });
      print({ burnTx: i + 1, txHash, amountUsdc: sendAmount });
    } catch (err) {
      // Don't bail on one failure — testnet RPC blips happen. Log and keep going.
      printError(err.code || "send_failed", `iteration ${i + 1}: ${err.message}`);
    }
  }

  print({
    spikeComplete: true,
    walletId,
    sendsAttempted: numSends,
    sendsConfirmed: sent.filter((s) => s.txHash).length,
    totalUsdcDrained: sent.reduce((sum, s) => (s.txHash ? sum + s.amountUsdc : sum), 0),
    txHashes: sent.filter((s) => s.txHash).map((s) => s.txHash),
  });
}

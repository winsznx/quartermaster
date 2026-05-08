/**
 * `zerion qm test x402-burn --wallet=<id> [--target=<addr>] [--rate=<calls-per-min>]
 *                            [--duration=<seconds>]`
 *
 * Drains the subordinate wallet via REAL x402-paid Zerion API calls. Each
 * iteration spawns `node cli/cli/zerion.js analyze <target> --x402` with
 * WALLET_PRIVATE_KEY set to the subordinate's derived EVM key (extracted
 * from upstream's keystore via the mnemonic export). Each call is a real
 * Base mainnet USDC transfer to the x402 facilitator (~$0.02 per call).
 *
 * The watcher reads the subordinate's now-lower balance via Zerion API,
 * derives the EWMA, and the layer-1 burn-rate-oracle policy refuses or
 * approves the resulting top-up based on real burn signal.
 *
 * No injected samples. No fake balances. No mocking. Each iteration is a
 * real on-chain x402 settlement.
 *
 * Sibling to `qm test spike` (which uses `zerion send` USDC transfers).
 * x402-burn is the canonical narrative — agents paying per API call.
 *
 * NOT an upstream command. Phase 7a deliverable.
 */

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { mnemonicToAccount } from "viem/accounts";

import { print, printError } from "../../cli/lib/util/output.js";
import { exportWallet } from "../../cli/lib/wallet/keystore.js";

import { buildSubprocessEnv } from "../../lib/qm/env.js";
import { getWallet } from "../../lib/fleet/registry.js";

const ZERION_CLI = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../cli/zerion.js",
);

const DEFAULT_TARGET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // vitalik.eth
const DEFAULT_RATE_PER_MIN = 6;
const DEFAULT_DURATION_SEC = 60;
const CALL_TIMEOUT_MS = 60_000;

function deriveEvmKey(mnemonic) {
  const account = mnemonicToAccount(mnemonic);
  return { privateKey: account.getHdKey().privateKey, address: account.address };
}

function runZerionAnalyzeX402(target, walletEvmKey) {
  return new Promise((resolveOnce, reject) => {
    const baseEnv = buildSubprocessEnv();
    // x402 mode reads WALLET_PRIVATE_KEY for the signing wallet — override
    // with subordinate's derived key so the subordinate (not the principal)
    // pays the per-call USDC.
    const env = { ...baseEnv, WALLET_PRIVATE_KEY: walletEvmKey };

    const child = spawn(
      "node",
      [ZERION_CLI, "analyze", target, "--x402"],
      { stdio: ["ignore", "pipe", "pipe"], env },
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(Object.assign(new Error(`x402 analyze: timeout after ${CALL_TIMEOUT_MS}ms`), { code: "subprocess_timeout" }));
    }, CALL_TIMEOUT_MS);

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
          Object.assign(new Error(`x402 analyze: exit ${exitCode}; stderr=${stderr.slice(0, 300)}`), {
            code: "subprocess_exit",
          }),
        );
      }
      try {
        resolveOnce(JSON.parse(stdout));
      } catch (err) {
        reject(
          Object.assign(new Error(`x402 analyze: non-JSON stdout (${err.message})`), {
            code: "subprocess_parse",
          }),
        );
      }
    });
  });
}

export default async function qmTestX402Burn(_args, flags) {
  const walletId = flags.wallet;
  const target = flags.target ?? DEFAULT_TARGET;
  const ratePerMin = Number(flags.rate ?? DEFAULT_RATE_PER_MIN);
  const duration = Number(flags.duration ?? DEFAULT_DURATION_SEC);

  if (!walletId || Number.isNaN(ratePerMin) || ratePerMin <= 0 || Number.isNaN(duration) || duration <= 0) {
    printError(
      "missing_args",
      "Usage: zerion qm test x402-burn --wallet=<id> [--target=<addr>] [--rate=<calls-per-min>] [--duration=<seconds>]",
    );
    process.exit(1);
  }

  const wallet = getWallet(walletId);
  if (!wallet) {
    printError("not_found", `wallet "${walletId}" not in fleet — register with "zerion fleet add" first`);
    process.exit(1);
  }

  const passphrase = process.env.QM_KEYSTORE_PASSPHRASE;
  if (!passphrase) {
    printError("missing_passphrase", "set QM_KEYSTORE_PASSPHRASE so the subordinate's mnemonic can be exported from upstream's keystore");
    process.exit(1);
  }

  // Export subordinate's mnemonic + derive EVM key. Done ONCE up-front so the
  // loop doesn't repeatedly hit the keystore.
  let subordinateKey;
  let subordinateAddr;
  try {
    const mnemonic = exportWallet(walletId, passphrase);
    if (typeof mnemonic !== "string" || mnemonic.length < 20) {
      throw Object.assign(new Error(`exportWallet returned unexpected shape (length=${mnemonic?.length})`), { code: "export_failed" });
    }
    const { privateKey, address } = deriveEvmKey(mnemonic);
    subordinateKey = `0x${Buffer.from(privateKey).toString("hex")}`;
    subordinateAddr = address;
  } catch (err) {
    printError(err.code || "key_export_failed", `failed to derive subordinate key for "${walletId}": ${err.message}`);
    process.exit(1);
  }

  const intervalMs = 60_000 / ratePerMin;
  const numCalls = Math.max(1, Math.floor((duration * 1000) / intervalMs));

  print({
    x402Burn: {
      walletId,
      walletAddress: subordinateAddr,
      target,
      ratePerMinute: ratePerMin,
      durationSec: duration,
      intervalSec: intervalMs / 1000,
      plannedCalls: numCalls,
    },
  });

  const sent = [];
  for (let i = 0; i < numCalls; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const t0 = Date.now();
      const response = await runZerionAnalyzeX402(target, subordinateKey);
      const elapsedMs = Date.now() - t0;
      const positionsCount = response?.positions?.count ?? null;
      const portfolioTotal = response?.portfolio?.total ?? null;
      sent.push({ i: i + 1, elapsedMs, positionsCount, portfolioTotal });
      print({ x402Call: i + 1, elapsedMs, positionsCount, portfolioTotal });
    } catch (err) {
      printError(err.code || "x402_call_failed", `iteration ${i + 1}: ${err.message}`);
      // Don't bail on one failure — facilitator hiccups happen. Log and keep going.
      sent.push({ i: i + 1, error: err.message });
    }
  }

  const succeeded = sent.filter((s) => !s.error);
  print({
    x402BurnComplete: true,
    walletId,
    walletAddress: subordinateAddr,
    callsAttempted: numCalls,
    callsSucceeded: succeeded.length,
    callsFailed: sent.length - succeeded.length,
    target,
  });
}

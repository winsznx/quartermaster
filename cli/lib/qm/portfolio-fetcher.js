/**
 * Production on-chain readers — spawn upstream `npx zerion` subprocesses
 * and parse the USDC balance for a wallet (subordinate observation) or for
 * a treasury source's wallet (treasury balance refresh).
 *
 * NOT an upstream file. Production fetchers wired into `cli/lib/qm/daemon.js`
 * as the defaults for `portfolioFetcher` and `balanceFetcher`. Tests still
 * inject their own fetchers via `options.*` — those overrides bypass these
 * production paths entirely.
 *
 * No fallback to zero, no fixtures, no fake values. If upstream's subprocess
 * fails, the fetcher throws so the watcher/hydrator surfaces the failure
 * (observeFleet captures it as `{ failed: true, error }` per-wallet) instead
 * of silently treating the wallet as drained.
 */

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSubprocessEnv } from "./env.js";

// Path to the LOCAL forked zerion CLI. `npx zerion` would resolve to the
// published package and miss our patches (chain registry, prompt env-var,
// etc.); always spawn our local copy.
const ZERION_CLI = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../cli/zerion.js",
);

const FETCH_TIMEOUT_MS = 30_000;

function runZerion(args, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [ZERION_CLI, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: buildSubprocessEnv(),
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        Object.assign(new Error(`zerion ${args.join(" ")}: timeout after ${timeoutMs}ms`), {
          code: "subprocess_timeout",
        }),
      );
    }, timeoutMs);

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
          Object.assign(
            new Error(`zerion ${args.join(" ")}: exit ${exitCode}; stderr=${stderr.slice(0, 200)}`),
            { code: "subprocess_exit" },
          ),
        );
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(
          Object.assign(
            new Error(`zerion ${args.join(" ")}: non-JSON stdout (${err.message})`),
            { code: "subprocess_parse" },
          ),
        );
      }
    });
  });
}

/**
 * Match an asset position by symbol (case-insensitive). Used by both
 * portfolio fetcher (USDC for subordinates) and source-balance fetcher
 * (configurable symbol per source).
 */
function findPositionBySymbol(positionsResponse, symbol) {
  const positions = positionsResponse?.positions ?? [];
  const lower = symbol.toLowerCase();
  return positions.find((p) => (p.symbol ?? "").toLowerCase() === lower);
}

/**
 * Production portfolioFetcher: returns the wallet's current USDC balance
 * by spawning `npx zerion positions <address> --positions simple`.
 *
 * The watcher derives recent burn from successive observations (PRD §9).
 */
export async function fetchPortfolio(address, _chainId) {
  const response = await runZerion(["positions", address, "--positions", "simple", "--chain", "base"]);
  const usdcPosition = findPositionBySymbol(response, "USDC");
  if (!usdcPosition) {
    // Wallet has no USDC position — treat as zero balance. This is
    // distinct from a subprocess failure: the chain says the wallet has
    // no USDC, which is real chain data.
    return { usdcBalance: 0 };
  }
  const quantity = usdcPosition.quantity ?? usdcPosition.attributes?.quantity?.float;
  if (typeof quantity !== "number") {
    throw Object.assign(
      new Error(`fetchPortfolio: USDC position for ${address} missing numeric quantity`),
      { code: "portfolio_parse" },
    );
  }
  return { usdcBalance: quantity };
}

/**
 * Production balanceFetcher: returns the on-chain balance for a treasury
 * source's `walletAddress` filtered to the source's `symbol`. The decider
 * uses this to filter eligible sources by `balance >= topUpAmount + minRetainedBalance`.
 */
export async function fetchSourceBalance(source) {
  const response = await runZerion(["positions", source.walletAddress, "--positions", "simple"]);
  const position = findPositionBySymbol(response, source.symbol);
  if (!position) {
    // Source's wallet does not currently hold the configured asset. This
    // is real chain data — the source is not drainable right now.
    return 0;
  }
  const quantity = position.quantity ?? position.attributes?.quantity?.float;
  if (typeof quantity !== "number") {
    throw Object.assign(
      new Error(`fetchSourceBalance: ${source.symbol} position for ${source.walletAddress} missing numeric quantity`),
      { code: "balance_parse" },
    );
  }
  return quantity;
}

export const __testing = { runZerion, findPositionBySymbol };

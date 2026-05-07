/**
 * Production APY fetcher — spawns `npx zerion positions <address> --json` per
 * source and parses the matching position's `apr` (or `apy`) field. Wired
 * into `cli/lib/qm/apy.js`'s `refreshApy` at daemon startup + hourly.
 *
 * Falls back to 0.0 + emits a `daemon_halt` ledger warning event on parse
 * failure so the operator sees the issue but the daemon doesn't crash —
 * yield-curve-preservation still works, it just sees the source as 0% APY
 * (which is conservative — it'll be picked first, draining the unyielding
 * source instead of liquidating a real yield position).
 *
 * NOT an upstream file. Phase 4.5 deliverable.
 */

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSubprocessEnv } from "./env.js";
import { appendEvent } from "./ledger.js";

const ZERION_CLI = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../cli/zerion.js",
);

const FETCH_TIMEOUT_MS = 30_000;

/**
 * Run `npx zerion positions <address>` and return parsed JSON. Throws on
 * non-zero exit, timeout, or unparseable stdout.
 */
function runZerionPositions(address, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [ZERION_CLI, "positions", address, "--positions", "defi"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: buildSubprocessEnv(),
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(Object.assign(new Error(`zerion positions ${address}: timeout after ${timeoutMs}ms`), { code: "subprocess_timeout" }));
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
        return reject(Object.assign(new Error(`zerion positions ${address}: exit ${exitCode}; stderr=${stderr.slice(0, 200)}`), { code: "subprocess_exit" }));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(Object.assign(new Error(`zerion positions ${address}: non-JSON stdout (${err.message})`), { code: "subprocess_parse" }));
      }
    });
  });
}

/**
 * Extract APR/APY from a positions response. Upstream's
 * `cli/cli/commands/analytics/positions.js` returns:
 *   { positions: [{ name, symbol, chain, value, ... }], ... }
 *
 * The Zerion API `apy` field lives on `attributes.flags.is_displayable` —
 * but our parsing here is defensive: we look for `apy`, `apr`, or
 * `attributes.apy` on each position and pick the first one that matches
 * the source's symbol.
 */
function extractApy(positionsResponse, source) {
  const positions = positionsResponse?.positions ?? [];
  const symbol = source.symbol.toLowerCase();
  for (const p of positions) {
    if ((p.symbol ?? "").toLowerCase() !== symbol) continue;
    const candidate = p.apy ?? p.apr ?? p.attributes?.apy ?? p.attributes?.apr;
    if (typeof candidate === "number" && candidate >= 0) return candidate;
    // Some Zerion responses surface APR as a percentage string (e.g., "3.2")
    if (typeof candidate === "string") {
      const num = parseFloat(candidate);
      if (!Number.isNaN(num) && num >= 0) {
        // Zerion returns decimal already (0.032 = 3.2%); if value > 1, assume percent
        return num > 1 ? num / 100 : num;
      }
    }
  }
  return null;
}

/**
 * Fetcher matching the `(source) => Promise<number>` shape that
 * `cli/lib/qm/apy.js` expects. Failure modes:
 *   - subprocess error → log to ledger, return 0.0
 *   - unparseable response → log to ledger, return 0.0
 *   - position not found → return 0.0 silently (idle USDC has no DeFi APY)
 */
export async function fetchApy(source) {
  try {
    const response = await runZerionPositions(source.walletAddress);
    const apy = extractApy(response, source);
    if (apy === null) return 0.0; // No matching position — idle balance, 0% APY.
    return apy;
  } catch (err) {
    appendEvent({
      type: "daemon_halt",
      reason: `apy-fetcher: source ${source.id} failed (${err.code || "unknown"}: ${err.message}); falling back to 0.0`,
    });
    return 0.0;
  }
}

export const __testing = { runZerionPositions, extractApy };

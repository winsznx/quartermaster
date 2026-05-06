/**
 * `zerion qm test spike --wallet=<id> --rate=<usdc-per-hour>` — demo-time
 * burn-rate injection per PRD §22.1. Synthesizes a BurnRateSample with the
 * specified ewmaHourlyBurn and a low usdcBalance so the next tick will pick
 * the wallet as needy.
 *
 * Used for the J1 demo moment: inject a 10x baseline spike, watch burn-rate-
 * oracle reject the resulting top-up plan with `BURN_RATE_ANOMALY_DETECTED`.
 *
 * NOT an upstream command. Phase 4 deliverable per PRD §31.5.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { BurnRateSample } from "@quartermaster/shared-schemas";

import { print, printError } from "../../cli/lib/util/output.js";

import { getWallet } from "../../lib/fleet/registry.js";
import { qmPath } from "../../lib/qm/storage.js";

export default async function qmTest(args, flags) {
  const [subcommand] = args;

  if (subcommand !== "spike") {
    printError("unknown_subcommand", `unknown qm test subcommand "${subcommand}". Available: spike`);
    process.exit(1);
  }

  const walletId = flags.wallet;
  const rate = Number(flags.rate);
  const balance = Number(flags.balance ?? 5);

  if (!walletId || Number.isNaN(rate)) {
    printError("missing_args", "Usage: zerion qm test spike --wallet=<id> --rate=<usdc-per-hour> [--balance=<usdc>]");
    process.exit(1);
  }

  try {
    const wallet = getWallet(walletId);
    if (!wallet) {
      printError("not_found", `wallet "${walletId}" not in fleet`);
      process.exit(1);
    }

    const now = new Date().toISOString();
    const sample = BurnRateSample.parse({
      walletId,
      usdcBalance: balance,
      sampledAt: now,
      // Make the spike look like sustained burn (24h at this rate) so it passes
      // sustained-need check, but baseline is tiny so spike-vs-baseline trips.
      last24hSpend: rate * 24,
      last7dSpend: 0.5 * 24 * 7, // 0.5 USDC/h baseline → spike ratio = rate/0.5
      ewmaHourlyBurn: rate,
      runwayHours: rate > 0 ? balance / rate : 1e9,
    });

    const path = qmPath("samples.jsonl");
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(sample)}\n`, { mode: 0o600 });

    print({ injected: true, sample });
  } catch (err) {
    printError(err.code || "spike_failed", err.message);
    process.exit(1);
  }
}

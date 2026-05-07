/**
 * burn-rate-oracle (PRD §8.3)
 *
 * Three checks, ALL must pass:
 *
 *   1. Sustained-need:    mean burn rate over last 24h > min_24h_total_spend
 *                         else NO_SUSTAINED_BURN
 *   2. Spike-vs-baseline: recent_hour_burn / 7d_baseline_hourly_burn ≤ spike_threshold
 *                         else BURN_RATE_ANOMALY_DETECTED
 *   3. Runway-validity:   current_balance / ewma_hourly_burn < minRunwayHours
 *                         else RUNWAY_NOT_BELOW_THRESHOLD
 *
 * Inputs are read from the most recent BurnRateSample in
 * `context.recentSamples` (the watcher precomputes EWMA + 24h/7d sums).
 * The EWMA helper (cli/lib/qm/ewma.js) is used by the watcher; this policy
 * trusts the precomputed value and does not re-step.
 *
 * Defaults per PRD §8.3:
 *   alpha (informational; watcher consumes)  = 0.30
 *   spike_threshold                          = 10
 *   min_24h_total_spend                      = 0.01
 *
 * Layer 1 (decider). Pure evaluator. NOT an upstream file.
 */

import {
  passResult,
  PolicyContext,
  REASON_CODES,
  rejectResult,
} from "@quartermaster/shared-schemas";

export const policyName = "burn-rate-oracle";
export const policyVersion = "1.0.0";

const DEFAULT_SPIKE_THRESHOLD = 10;
const DEFAULT_MIN_24H_TOTAL_SPEND = 0.001;
const HOURS_24 = 24;
const HOURS_7D = 24 * 7;

export async function evaluate(context) {
  const parsed = PolicyContext.safeParse(context);
  if (!parsed.success) {
    return rejectResult(
      REASON_CODES.MALFORMED_CONTEXT,
      `burn-rate-oracle: malformed PolicyContext (${parsed.error.issues.length} issue(s))`,
    );
  }

  const ctx = parsed.data;

  if (ctx.recentSamples.length === 0) {
    return rejectResult(
      REASON_CODES.MALFORMED_CONTEXT,
      "burn-rate-oracle: recentSamples must include at least one sample for the target wallet",
    );
  }

  const ownSamples = ctx.recentSamples.filter(
    (s) => s.walletId === ctx.targetWallet.id,
  );
  if (ownSamples.length === 0) {
    return rejectResult(
      REASON_CODES.MALFORMED_CONTEXT,
      `burn-rate-oracle: no samples for target wallet "${ctx.targetWallet.id}"`,
    );
  }

  // Latest sample = most recent sampledAt for THIS wallet.
  const latest = ownSamples
    .slice()
    .sort((a, b) => Date.parse(a.sampledAt) - Date.parse(b.sampledAt))[
      ownSamples.length - 1
    ];

  const cfg = ctx.policyConfig;
  const spikeThreshold = Number(cfg.spike_threshold ?? DEFAULT_SPIKE_THRESHOLD);
  const min24hTotalSpend = Number(
    cfg.min_24h_total_spend ?? DEFAULT_MIN_24H_TOTAL_SPEND,
  );

  // Check 1 — sustained need: mean hourly burn over the last 24h > floor.
  const meanHourly24h = latest.last24hSpend / HOURS_24;
  if (meanHourly24h <= min24hTotalSpend) {
    return rejectResult(
      REASON_CODES.NO_SUSTAINED_BURN,
      `mean 24h hourly burn ${meanHourly24h.toFixed(4)} USDC/h is at or below the sustained-need floor ${min24hTotalSpend.toFixed(4)} USDC/h`,
    );
  }

  // Check 2 — spike vs 7d baseline.
  const baseline7dHourly = latest.last7dSpend / HOURS_7D;
  if (baseline7dHourly <= 0) {
    return rejectResult(
      REASON_CODES.NO_SUSTAINED_BURN,
      "burn-rate-oracle: 7d baseline hourly burn is 0; cannot compute spike ratio",
    );
  }
  const recentHourBurn = latest.ewmaHourlyBurn;
  const spikeRatio = recentHourBurn / baseline7dHourly;
  if (spikeRatio > spikeThreshold) {
    return rejectResult(
      REASON_CODES.BURN_RATE_ANOMALY_DETECTED,
      `recent hourly burn ${recentHourBurn.toFixed(4)} is ${spikeRatio.toFixed(2)}× the 7d baseline ${baseline7dHourly.toFixed(4)} (threshold ${spikeThreshold}×)`,
    );
  }

  // Check 3 — runway validity. The watcher should already have filtered the
  // wallet for runway-below-threshold; this is a defensive re-check.
  if (latest.ewmaHourlyBurn <= 0) {
    return rejectResult(
      REASON_CODES.NO_SUSTAINED_BURN,
      "burn-rate-oracle: ewmaHourlyBurn is 0; cannot compute projected runway",
    );
  }
  const projectedRunway = latest.usdcBalance / latest.ewmaHourlyBurn;
  if (projectedRunway >= ctx.targetWallet.minRunwayHours) {
    return rejectResult(
      REASON_CODES.RUNWAY_NOT_BELOW_THRESHOLD,
      `projected runway ${projectedRunway.toFixed(1)}h is at or above the minRunwayHours threshold ${ctx.targetWallet.minRunwayHours}h; top-up not needed yet`,
    );
  }

  return passResult();
}

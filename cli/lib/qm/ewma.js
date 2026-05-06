/**
 * Exponentially Weighted Moving Average — PRD §8.3.
 *
 *   ewma_hourly_burn(t) = α · spend_in_last_hour(t) + (1 - α) · ewma_hourly_burn(t - 1h)
 *
 * Default α = 0.30 (half-life ≈ 2h). Pure functions; importable by the
 * burn-rate-oracle policy and by the Phase 4 watcher (which persists the
 * running EWMA per wallet).
 *
 * NOT an upstream file. Phase 3 deliverable per PRD §8.3.
 */

export const DEFAULT_ALPHA = 0.30;

/**
 * Compute next EWMA value given the previous value, the most recent hour's
 * spend, and α.
 *
 * `previous` should be passed as 0 on the first sample (cold start) — the
 * formula degenerates to `α · spend` which is the right initial estimate.
 */
export function ewmaStep(previous, recentHourSpend, alpha = DEFAULT_ALPHA) {
  if (alpha <= 0 || alpha > 1) {
    throw new Error(`ewmaStep: alpha must be in (0, 1], got ${alpha}`);
  }
  if (previous < 0 || recentHourSpend < 0) {
    throw new Error("ewmaStep: inputs must be non-negative");
  }
  return alpha * recentHourSpend + (1 - alpha) * previous;
}

/**
 * Run the EWMA recurrence over an array of hourly-spend samples in
 * chronological order (oldest first). Returns the final EWMA value plus
 * the trace for debugging.
 *
 * Used by tests to validate the closed-form behavior; the daemon itself
 * persists the running EWMA per wallet rather than recomputing each tick.
 */
export function ewmaSeries(spendsPerHour, alpha = DEFAULT_ALPHA) {
  let prev = 0;
  const trace = [];
  for (const s of spendsPerHour) {
    prev = ewmaStep(prev, s, alpha);
    trace.push(prev);
  }
  return { final: prev, trace };
}

/**
 * Mean hourly burn over a sample series — used by burn-rate-oracle's
 * sustained-need check (PRD §8.3 check 1).
 *
 * Returns 0 on empty input. Filtering to "last 24h" is the caller's job;
 * this function just averages whatever hourly spends it gets.
 */
export function meanHourlyBurn(spendsPerHour) {
  if (!spendsPerHour || spendsPerHour.length === 0) return 0;
  let total = 0;
  for (const s of spendsPerHour) total += s;
  return total / spendsPerHour.length;
}

/**
 * Decider — given watcher output (per-wallet sample + underThreshold flag),
 * pick the most-needy target, choose a source via yield-curve sort, build
 * a `TopUpAction` (state: "planned"), assemble the PolicyContext, run all
 * layer-1 policies via cli/lib/qm/run-policies.js (Phase 3 dispatcher).
 *
 * Returns one of:
 *   { kind: "no_action", reason: "..." }                        — nothing needs top-up
 *   { kind: "no_source", target: walletId }                     — nothing eligible to drain
 *   { kind: "blocked", action, failedPolicy, reasonCode, reasonText, evaluations }
 *   { kind: "planned", action, evaluations }                    — clear to proceed to executor
 *
 * Pure function (modulo crypto.randomUUID for actionId). The watcher
 * provides `now`; the decider passes it through to PolicyContext.
 */

import { randomUUID } from "node:crypto";

import { runPolicies } from "./run-policies.js";

/**
 * Sort wallets by neediness: lowest runwayHours first.
 */
function pickNeediestTarget(observations) {
  const candidates = observations.filter(
    (o) => o.sample != null && o.underThreshold,
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.sample.runwayHours - b.sample.runwayHours);
  return candidates[0];
}

/**
 * Filter sources by `balance >= topUpAmount + minRetainedBalance` and sort by
 * `(currentApyEstimate ASC, priority ASC)`. Mirrors PRD §8.4 line 1-3 so the
 * yield-curve-preservation policy and the decider agree on selection.
 */
function eligibleSourcesSorted(sources, topUpAmount) {
  return sources
    .filter((s) => s.balance >= topUpAmount + s.minRetainedBalance)
    .sort((a, b) => {
      if (a.currentApyEstimate !== b.currentApyEstimate) {
        return a.currentApyEstimate - b.currentApyEstimate;
      }
      return a.priority - b.priority;
    });
}

/**
 * Compute the planned top-up amount: enough to hit `targetRunwayHours` at the
 * current EWMA burn, capped by `maxPerActionUsdc` from policyConfig (or 100
 * USDC default — same as max-per-action-cap policy default).
 */
function computeTopUpAmount(target, sample, maxPerActionUsdc) {
  const target_balance = sample.ewmaHourlyBurn * target.targetRunwayHours;
  const needed = Math.max(0, target_balance - sample.usdcBalance);
  return Math.min(needed, maxPerActionUsdc);
}

/**
 * Build the action.lastConfirmed lookup for a target by scanning recent ledger
 * events. The watcher / daemon caller pre-fetches this and passes via
 * `options.lastConfirmedActionForTarget`.
 *
 * Decoupling the ledger read from the decider keeps this function pure.
 */
export async function decide({
  observations,
  treasurySources,
  recentSamples,
  lastConfirmedActionForTarget,
  policyConfig,
  now,
}) {
  const targetEntry = pickNeediestTarget(observations);
  if (!targetEntry) {
    return { kind: "no_action", reason: "no wallet under minRunwayHours threshold" };
  }
  const { wallet: targetWallet, sample } = targetEntry;

  const maxPerAction =
    policyConfig?.["max-per-action-cap"]?.maxPerActionUsdc ??
    policyConfig?.maxPerActionUsdc ??
    100;
  const topUpAmount = computeTopUpAmount(targetWallet, sample, maxPerAction);
  if (topUpAmount <= 0) {
    return {
      kind: "no_action",
      reason: `target wallet "${targetWallet.id}" balance already meets target`,
    };
  }

  const sortedSources = eligibleSourcesSorted(treasurySources, topUpAmount);
  if (sortedSources.length === 0) {
    return { kind: "no_source", target: targetWallet.id };
  }
  const selectedSource = sortedSources[0];

  const actionId = randomUUID();
  const action = {
    actionId,
    targetWalletId: targetWallet.id,
    topUpAmountUsdc: Number(topUpAmount.toFixed(6)),
    sourceId: selectedSource.id,
    state: "planned",
    txHashes: {},
    policyChecks: [],
    createdAt: now,
  };

  const policyContext = {
    proposedAction: action,
    targetWallet,
    selectedSource,
    allEligibleSources: sortedSources,
    recentSamples,
    lastConfirmedActionForTarget: lastConfirmedActionForTarget ?? null,
    policyConfig: policyConfig ?? {},
    now,
  };

  const result = await runPolicies(policyContext);
  if (!result.ok) {
    return {
      kind: "blocked",
      action,
      failedPolicy: result.failedPolicy,
      reasonCode: result.reasonCode,
      reasonText: result.reasonText,
      evaluations: result.evaluations,
    };
  }

  return { kind: "planned", action, evaluations: result.evaluations };
}

export const __testing = {
  pickNeediestTarget,
  eligibleSourcesSorted,
  computeTopUpAmount,
};

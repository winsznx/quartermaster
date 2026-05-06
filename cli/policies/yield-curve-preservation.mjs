/**
 * yield-curve-preservation (PRD §8.4)
 *
 *   1. Filter allEligibleSources where balance >= top_up_amount + minRetainedBalance
 *   2. Sort by (currentApyEstimate ASC, priority ASC)
 *   3. Selected source MUST equal sorted[0]; otherwise reject YIELD_CURVE_VIOLATION
 *
 * The orchestrator pre-filters and pre-sorts `allEligibleSources` per the
 * decider step (§8.4 line 1). This policy validates that the orchestrator's
 * pick (`selectedSource`) is actually the top of that sorted list — catches
 * a bug where the decider drains stETH while idle USDC could have covered.
 *
 * Layer 1 (decider). Pure evaluator. NOT an upstream file.
 */

import {
  passResult,
  PolicyContext,
  REASON_CODES,
  rejectResult,
} from "@quartermaster/shared-schemas";

export const policyName = "yield-curve-preservation";
export const policyVersion = "1.0.0";

function isEligible(source, topUpAmount) {
  return source.balance >= topUpAmount + source.minRetainedBalance;
}

function sortByApyAscThenPriority(sources) {
  return sources.slice().sort((a, b) => {
    if (a.currentApyEstimate !== b.currentApyEstimate) {
      return a.currentApyEstimate - b.currentApyEstimate;
    }
    return a.priority - b.priority;
  });
}

export async function evaluate(context) {
  const parsed = PolicyContext.safeParse(context);
  if (!parsed.success) {
    return rejectResult(
      REASON_CODES.MALFORMED_CONTEXT,
      `yield-curve-preservation: malformed PolicyContext (${parsed.error.issues.length} issue(s))`,
    );
  }

  const ctx = parsed.data;

  if (ctx.allEligibleSources.length === 0) {
    return rejectResult(
      REASON_CODES.MALFORMED_CONTEXT,
      "yield-curve-preservation: allEligibleSources is empty; orchestrator must populate from treasury",
    );
  }

  // Re-filter inside the policy as a sanity check — the orchestrator should
  // have done this but the cost is trivial and it keeps the policy honest
  // even if the orchestrator is buggy.
  // PRD §8.4 line 1: balance >= top_up_amount + minRetainedBalance
  const eligibleAfterCheck = ctx.allEligibleSources.filter((s) =>
    isEligible(s, ctx.proposedAction.topUpAmountUsdc),
  );
  if (eligibleAfterCheck.length === 0) {
    return rejectResult(
      REASON_CODES.YIELD_CURVE_VIOLATION,
      "no source carries balance >= topUpAmount + minRetainedBalance; orchestrator should not have planned this action",
    );
  }

  const sorted = sortByApyAscThenPriority(eligibleAfterCheck);
  const correct = sorted[0];

  if (ctx.selectedSource.id !== correct.id) {
    return rejectResult(
      REASON_CODES.YIELD_CURVE_VIOLATION,
      `proposed source "${ctx.selectedSource.id}" (APY ${(ctx.selectedSource.currentApyEstimate * 100).toFixed(2)}%, priority ${ctx.selectedSource.priority}) is not the lowest-yield eligible; "${correct.id}" (APY ${(correct.currentApyEstimate * 100).toFixed(2)}%, priority ${correct.priority}) was eligible and should drain first`,
    );
  }

  return passResult();
}

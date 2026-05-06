/**
 * max-per-action-cap (PRD §8.6)
 *
 *   if topUpAmountUsdc > MAX_USDC_PER_ACTION: reject CAP_EXCEEDED
 *
 * Default cap: 100 USDC. Tunable via policyConfig.maxPerActionUsdc.
 *
 * Layer 1 (decider). Pure evaluator. NOT an upstream file.
 */

import {
  passResult,
  PolicyContext,
  REASON_CODES,
  rejectResult,
} from "@quartermaster/shared-schemas";

export const policyName = "max-per-action-cap";
export const policyVersion = "1.0.0";

const DEFAULT_MAX_USDC_PER_ACTION = 100;

export async function evaluate(context) {
  const parsed = PolicyContext.safeParse(context);
  if (!parsed.success) {
    return rejectResult(
      REASON_CODES.MALFORMED_CONTEXT,
      `max-per-action-cap: malformed PolicyContext (${parsed.error.issues.length} issue(s))`,
    );
  }

  const ctx = parsed.data;
  const cap = Number(
    ctx.policyConfig.maxPerActionUsdc ?? DEFAULT_MAX_USDC_PER_ACTION,
  );
  const amount = ctx.proposedAction.topUpAmountUsdc;

  if (amount > cap) {
    return rejectResult(
      REASON_CODES.CAP_EXCEEDED,
      `top-up ${amount.toFixed(2)} USDC exceeds per-action cap ${cap.toFixed(2)} USDC`,
    );
  }

  return passResult();
}

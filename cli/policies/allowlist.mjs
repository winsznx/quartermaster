/**
 * Layer-1 (decider-time) allowlist policy.
 *
 * Rejects if the action's target wallet is not registered in the fleet.
 * The orchestrator (Phase 4 daemon decider) populates
 * `policyConfig.allowedTargetIds` with the current fleet registry's wallet
 * IDs so this policy stays a pure evaluator.
 *
 * NOT to be confused with upstream's sign-time `cli/cli/policies/allowlist.mjs`
 * which guards EVM tx-level recipients. Both run; both must pass. See
 * MASTER_PRD §8.0.
 */

import {
  passResult,
  PolicyContext,
  REASON_CODES,
  rejectResult,
} from "@quartermaster/shared-schemas";

export const policyName = "allowlist";
export const policyVersion = "1.0.0";

export async function evaluate(context) {
  const parsed = PolicyContext.safeParse(context);
  if (!parsed.success) {
    return rejectResult(
      REASON_CODES.MALFORMED_CONTEXT,
      `allowlist: malformed PolicyContext (${parsed.error.issues.length} issue(s))`,
    );
  }

  const ctx = parsed.data;
  const allowed = Array.isArray(ctx.policyConfig.allowedTargetIds)
    ? ctx.policyConfig.allowedTargetIds
    : [];

  if (allowed.length === 0) {
    return rejectResult(
      REASON_CODES.MALFORMED_CONTEXT,
      "allowlist: policyConfig.allowedTargetIds missing or empty (orchestrator must preload from fleet registry)",
    );
  }

  if (!allowed.includes(ctx.proposedAction.targetWalletId)) {
    return rejectResult(
      REASON_CODES.NOT_IN_FLEET,
      `target wallet "${ctx.proposedAction.targetWalletId}" is not in fleet allowlist`,
    );
  }

  return passResult();
}

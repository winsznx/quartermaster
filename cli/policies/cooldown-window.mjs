/**
 * cooldown-window (PRD §8.5)
 *
 *   1. Read lastConfirmedActionForTarget from context (orchestrator preloads
 *      from ledger; this policy never touches fs).
 *   2. If now - lastConfirmed.confirmedAt < COOLDOWN_MIN minutes: reject
 *      COOLDOWN_VIOLATION.
 *
 * Default COOLDOWN_MIN: 30. Tunable via policyConfig.minCooldownMinutes.
 *
 * Layer 1 (decider). Pure evaluator. NOT an upstream file.
 */

import {
  passResult,
  PolicyContext,
  REASON_CODES,
  rejectResult,
} from "@quartermaster/shared-schemas";

export const policyName = "cooldown-window";
export const policyVersion = "1.0.0";

const DEFAULT_COOLDOWN_MINUTES = 30;

export async function evaluate(context) {
  const parsed = PolicyContext.safeParse(context);
  if (!parsed.success) {
    return rejectResult(
      REASON_CODES.MALFORMED_CONTEXT,
      `cooldown-window: malformed PolicyContext (${parsed.error.issues.length} issue(s))`,
    );
  }

  const ctx = parsed.data;
  const cooldownMinutes = Number(
    ctx.policyConfig.minCooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES,
  );

  // First-ever top-up to this target — no previous action, no cooldown to honor.
  if (ctx.lastConfirmedActionForTarget === null) return passResult();

  const last = ctx.lastConfirmedActionForTarget;

  // Without a confirmedAt we cannot compute elapsed time. The orchestrator is
  // expected to only attach actions that have actually confirmed; missing the
  // field is a context bug.
  if (!last.confirmedAt) {
    return rejectResult(
      REASON_CODES.MALFORMED_CONTEXT,
      "cooldown-window: lastConfirmedActionForTarget present but confirmedAt missing",
    );
  }

  const elapsedMs = Date.parse(ctx.now) - Date.parse(last.confirmedAt);
  if (Number.isNaN(elapsedMs)) {
    return rejectResult(
      REASON_CODES.MALFORMED_CONTEXT,
      "cooldown-window: failed to parse now or confirmedAt as ISO timestamps",
    );
  }

  const elapsedMinutes = elapsedMs / 60_000;
  if (elapsedMinutes < cooldownMinutes) {
    const remaining = (cooldownMinutes - elapsedMinutes).toFixed(1);
    return rejectResult(
      REASON_CODES.COOLDOWN_VIOLATION,
      `target "${ctx.proposedAction.targetWalletId}" was topped up ${elapsedMinutes.toFixed(1)} min ago; ${remaining} min remain in cooldown window (${cooldownMinutes} min)`,
    );
  }

  return passResult();
}

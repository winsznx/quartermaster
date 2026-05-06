/**
 * QM (layer-1) policy dispatcher — PRD §8.0 + §8.7.
 *
 * - ALL-must-pass; first failure short-circuits.
 * - Pure evaluation: no fs, no network, no clock — uses context.now.
 * - Register order matters and is locked: allowlist → max-per-action-cap →
 *   cooldown-window → burn-rate-oracle → yield-curve-preservation.
 *
 * NOT to be confused with upstream's sign-time
 * `cli/cli/policies/run-policies.mjs`. Both layers run for every action;
 * see MASTER_PRD §8.0.
 */

import * as allowlist from "../../policies/allowlist.mjs";
import * as maxPerActionCap from "../../policies/max-per-action-cap.mjs";
import * as cooldownWindow from "../../policies/cooldown-window.mjs";
import * as burnRateOracle from "../../policies/burn-rate-oracle.mjs";
import * as yieldCurvePreservation from "../../policies/yield-curve-preservation.mjs";

/**
 * The locked layer-1 registry. Order matters — runtime evaluation walks
 * this list and short-circuits on the first failure. Adding a policy is a
 * one-line append plus a file in cli/policies/ (PRD §8.7).
 */
const REGISTRY = [
  { module: allowlist, namespace: "allowlist" },
  { module: maxPerActionCap, namespace: "max-per-action-cap" },
  { module: cooldownWindow, namespace: "cooldown-window" },
  { module: burnRateOracle, namespace: "burn-rate-oracle" },
  { module: yieldCurvePreservation, namespace: "yield-curve-preservation" },
];

export const REGISTERED_POLICIES = REGISTRY.map((entry) => ({
  policyName: entry.module.policyName,
  policyVersion: entry.module.policyVersion,
}));

/**
 * Build the per-policy slice of `policyConfig` from a flat root config.
 *
 * Convention: top-level keys are policy namespaces (e.g.
 * `{ "max-per-action-cap": { maxPerActionUsdc: 50 }, ... }`). Each policy
 * receives ITS namespace's value as `context.policyConfig`.
 *
 * Keys not under a namespace are passed through (so `allowedTargetIds`
 * preloaded by the orchestrator at the root applies to every policy that
 * reads it).
 */
function configForPolicy(rootConfig, namespace) {
  if (!rootConfig || typeof rootConfig !== "object") return {};
  const passthrough = {};
  for (const [key, value] of Object.entries(rootConfig)) {
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      // namespace bucket — only merge if this is OUR namespace
      if (key === namespace) Object.assign(passthrough, value);
    } else {
      // top-level scalar/array — pass through to every policy
      passthrough[key] = value;
    }
  }
  return passthrough;
}

/**
 * Run all registered layer-1 policies against `baseContext`. Returns one of:
 *
 *   { ok: true, evaluations: PolicyCheck[] }
 *   { ok: false, reasonCode, reasonText, failedPolicy, evaluations }
 *
 * `evaluations` mirrors PRD §7 PolicyCheck shape so the daemon can attach it
 * directly to TopUpAction.policyChecks.
 *
 * Each policy is invoked with a context whose `policyConfig` field is the
 * merged per-policy slice (see configForPolicy). All other context fields
 * are passed through.
 */
export async function runPolicies(baseContext, options = {}) {
  const onEvaluation = options.onEvaluation;
  const evaluations = [];
  for (const entry of REGISTRY) {
    const policyConfig = configForPolicy(
      baseContext.policyConfig,
      entry.namespace,
    );
    const ctx = { ...baseContext, policyConfig };

    const result = await entry.module.evaluate(ctx);
    const check = {
      policyName: entry.module.policyName,
      passed: result.ok,
      reasonCode: result.ok ? undefined : result.reasonCode,
      reasonText: result.ok ? undefined : result.reasonText,
      evaluatedAt: baseContext.now,
    };
    evaluations.push(check);
    if (typeof onEvaluation === "function") onEvaluation(check);

    if (!result.ok) {
      return {
        ok: false,
        reasonCode: result.reasonCode,
        reasonText: result.reasonText,
        failedPolicy: entry.module.policyName,
        evaluations,
      };
    }
  }
  return { ok: true, evaluations };
}

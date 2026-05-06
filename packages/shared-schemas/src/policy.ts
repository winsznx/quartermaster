import { z } from "zod";

import { TreasurySourceWithBalance } from "./api.ts";
import {
  BurnRateSample,
  SubordinateWallet,
  TopUpAction,
} from "./domain.ts";
import { IsoTimestamp } from "./primitives.ts";

/**
 * Reason codes — LOCKED per PRD §8. Every layer-1 policy that rejects MUST
 * use one of these as its `reasonCode`. Downstream code (executor, ledger,
 * dashboard) imports this constant rather than referencing string literals.
 *
 * Adding a code here is the only way to introduce a new reject reason.
 */
export const REASON_CODES = {
  // Layer-1 (decider-time) reject reasons:
  CAP_EXCEEDED: "CAP_EXCEEDED", // max-per-action-cap §8.6
  COOLDOWN_VIOLATION: "COOLDOWN_VIOLATION", // cooldown-window §8.5
  NO_SUSTAINED_BURN: "NO_SUSTAINED_BURN", // burn-rate-oracle §8.3 check 1
  BURN_RATE_ANOMALY_DETECTED: "BURN_RATE_ANOMALY_DETECTED", // burn-rate-oracle §8.3 check 2
  RUNWAY_NOT_BELOW_THRESHOLD: "RUNWAY_NOT_BELOW_THRESHOLD", // burn-rate-oracle §8.3 check 3
  YIELD_CURVE_VIOLATION: "YIELD_CURVE_VIOLATION", // yield-curve-preservation §8.4
  NOT_IN_FLEET: "NOT_IN_FLEET", // allowlist (decider-time)
  // Defensive — context arrived missing a required field:
  MALFORMED_CONTEXT: "MALFORMED_CONTEXT",
} as const;

export type ReasonCode = (typeof REASON_CODES)[keyof typeof REASON_CODES];

const ReasonCodeSchema = z.enum(
  Object.values(REASON_CODES) as [ReasonCode, ...ReasonCode[]],
);

/**
 * Per-policy config — opaque to the dispatcher. Each policy reads its own
 * keys defensively. Defaults live in the policy file, not here.
 */
const PolicyConfig = z.record(z.string(), z.unknown());

/**
 * PolicyContext — the input every layer-1 policy sees.
 *
 * The orchestrator (Phase 4 daemon decider) builds this once per planned
 * action and passes the same object to every policy. Policies are pure
 * evaluators: read fields, return result, never mutate, never touch the
 * filesystem or network.
 */
export const PolicyContext = z
  .object({
    proposedAction: TopUpAction,
    targetWallet: SubordinateWallet,
    selectedSource: TreasurySourceWithBalance,
    allEligibleSources: z.array(TreasurySourceWithBalance),
    recentSamples: z.array(BurnRateSample),
    lastConfirmedActionForTarget: TopUpAction.nullable(),
    policyConfig: PolicyConfig,
    now: IsoTimestamp,
  })
  .strict();
export type PolicyContext = z.infer<typeof PolicyContext>;

/**
 * PolicyResult — discriminated union over `ok`. Pass = `{ ok: true }`. Reject
 * carries the locked reasonCode + a human-readable reasonText.
 */
export const PolicyResult = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }).strict(),
  z
    .object({
      ok: z.literal(false),
      reasonCode: ReasonCodeSchema,
      reasonText: z.string().min(1),
    })
    .strict(),
]);
export type PolicyResult = z.infer<typeof PolicyResult>;

/**
 * Convenience constructors so policy authors can't forget to include a field.
 */
export function passResult(): PolicyResult {
  return { ok: true };
}

export function rejectResult(
  reasonCode: ReasonCode,
  reasonText: string,
): PolicyResult {
  return { ok: false, reasonCode, reasonText };
}

/**
 * `zerion qm plan` — dry-run: hydrate state, run the decider against the
 * current snapshot, print the plan WITHOUT executing.
 *
 * Useful for `--demo` rehearsal and for the operator to preview what the
 * next tick would do.
 */

import { print, printError } from "../../cli/lib/util/output.js";

import { hydrateState } from "../../lib/qm/daemon.js";
import { decide } from "../../lib/qm/decider.js";

export default async function qmPlan(_args, flags) {
  try {
    const state = await hydrateState();
    const observations = state.observations ?? [];
    const recentSamples = observations.filter((o) => o.sample).map((o) => o.sample);
    const target = observations.find((o) => o.underThreshold && !o.failed);
    const lastConfirmed = target
      ? state.lastConfirmedByWallet?.get(target.wallet.id) ?? null
      : null;

    const decision = await decide({
      observations,
      treasurySources: state.treasury,
      recentSamples,
      lastConfirmedActionForTarget: lastConfirmed,
      policyConfig: { allowedTargetIds: state.fleet.map((w) => w.id) },
      now: new Date().toISOString(),
    });

    print({ decision, plan: decision.kind === "planned" ? decision.action : null });
  } catch (err) {
    printError(err.code || "plan_failed", err.message);
    process.exit(1);
  }
}

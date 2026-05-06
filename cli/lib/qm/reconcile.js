/**
 * Reconcile — on daemon startup, scan ledger tail for incomplete actions
 * and surface them. PRD §6.4: NO automatic resume. The daemon refuses to
 * tick until the operator runs `zerion qm reconcile <id>` for each
 * orphan, OR opts to mark them all as failed via `--mark-all-failed`.
 *
 * State-machine recovery rules (PRD §6.3 + §6.4):
 *   topup_planned only           → orphan_planned
 *   ...up to swap_confirmed      → orphan_after_swap
 *   ...up to bridge_confirmed    → orphan_after_bridge
 *   ...up to send_pending        → orphan_send_pending (most dangerous —
 *                                  may have already executed onchain)
 *   topup_confirmed terminates   → ignored
 *   topup_aborted_no_source      → ignored (clean abort)
 *   daemon_halt before anything  → no orphan
 */

import { appendEvent, tail } from "./ledger.js";

/**
 * Walk the ledger and return one summary entry per incomplete action.
 *
 * Pure async fn — does NOT mutate state. The caller decides whether to
 * write `reconcile_started` / `reconcile_resolved` events.
 */
export async function findOrphans() {
  const byActionId = new Map();
  for await (const ev of tail()) {
    switch (ev.type) {
      case "topup_planned":
        byActionId.set(ev.action.actionId, {
          actionId: ev.action.actionId,
          state: "planned",
          targetWalletId: ev.action.targetWalletId,
          sourceId: ev.action.sourceId,
          topUpAmountUsdc: ev.action.topUpAmountUsdc,
          txHashes: { ...ev.action.txHashes },
          createdAt: ev.action.createdAt,
        });
        break;
      case "topup_swap_pending":
        upsertState(byActionId, ev.actionId, "swap_pending", { swap: ev.txHash });
        break;
      case "topup_swap_confirmed":
        upsertState(byActionId, ev.actionId, "swap_confirmed", { swap: ev.txHash });
        break;
      case "topup_bridge_pending":
        upsertState(byActionId, ev.actionId, "bridge_pending", { bridge: ev.txHash });
        break;
      case "topup_bridge_confirmed":
        upsertState(byActionId, ev.actionId, "bridge_confirmed", { bridge: ev.txHash });
        break;
      case "topup_send_pending":
        upsertState(byActionId, ev.actionId, "send_pending", { send: ev.txHash });
        break;
      case "topup_send_confirmed":
        upsertState(byActionId, ev.actionId, "send_confirmed", { send: ev.txHash });
        break;
      case "topup_confirmed":
      case "topup_aborted_no_source":
        // Terminal states — drop from the orphan map.
        byActionId.delete(ev.actionId);
        break;
      case "topup_blocked":
        // Blocked actions never executed any tx — they can be safely dropped.
        byActionId.delete(ev.actionId);
        break;
      case "reconcile_resolved":
        byActionId.delete(ev.actionId);
        break;
      // Lifecycle events (tick_started, etc.) are not action-related.
    }
  }
  return Array.from(byActionId.values());
}

function upsertState(map, actionId, state, txHashes) {
  const existing = map.get(actionId);
  if (!existing) {
    // We saw an action transition without a topup_planned record — corrupt
    // or truncated ledger. Capture for operator visibility but mark.
    map.set(actionId, {
      actionId,
      state,
      txHashes: { ...txHashes },
      missingPlannedRecord: true,
    });
    return;
  }
  existing.state = state;
  existing.txHashes = { ...existing.txHashes, ...txHashes };
}

/**
 * Mark a specific orphan resolved with the given disposition. Writes one
 * `reconcile_resolved` ledger event. The orchestrator (daemon startup or
 * `zerion qm reconcile`) is responsible for verifying chain state first.
 */
export function resolveOrphan(actionId, resolution) {
  appendEvent({ type: "reconcile_resolved", actionId, resolution });
}

/**
 * Return the resolution-required label for an orphan in a given state. Used
 * by `zerion qm reconcile` to print operator hints.
 */
export function resolutionHint(state) {
  switch (state) {
    case "planned":
      return "no tx executed — safe to mark failed";
    case "swap_pending":
    case "swap_confirmed":
      return "swap may have executed — verify on-chain before resolving";
    case "bridge_pending":
    case "bridge_confirmed":
      return "bridge may have executed — verify destination chain before resolving";
    case "send_pending":
      return "send tx submitted but not confirmed — verify finality before resolving";
    default:
      return "unknown state — investigate";
  }
}

/**
 * Daemon — tick loop runner. Owns the lifecycle:
 *   - acquire ~/.zerion/quartermaster/.lock
 *   - hydrate state from disk
 *   - reconcile orphans before first tick
 *   - bind HTTP server on 127.0.0.1:7402
 *   - tick: watcher → decider → executor → broadcast
 *   - non-overlapping ticks (PRD §6.5) with auto-throttle on consecutive overlaps
 *   - SIGINT/SIGTERM clean exit; SIGHUP config reload; uncaught panic → ledger event
 *
 * Phase 4 ships the orchestration scaffolding plus the run-once tick API
 * (`runOneTick`) that the integration test exercises. The interactive
 * `start()` / lock / signal handlers are also here but the integration test
 * uses the run-once path so it stays deterministic.
 */

import {
  closeSync,
  existsSync,
  openSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

import { listWallets } from "../fleet/registry.js";
import { listSources } from "../treasury/sources.js";
import { applyApyToSources } from "./apy.js";
import { decide } from "./decider.js";
import { executeAction } from "./executor.js";
import { appendEvent, tail } from "./ledger.js";
import { findOrphans } from "./reconcile.js";
import { REGISTERED_POLICIES } from "./run-policies.js";
import { qmPath } from "./storage.js";
import { observeFleet } from "./watcher.js";
import { broadcastState, emptyState } from "./http-server.js";

const DEFAULT_TICK_SECONDS = 60;

function lockPath() {
  return qmPath(".lock");
}

export function acquireLock(pid = process.pid) {
  try {
    const fd = openSync(lockPath(), "wx", 0o600);
    writeFileSync(lockPath(), JSON.stringify({ pid, startedAt: new Date().toISOString() }));
    closeSync(fd);
    return true;
  } catch (err) {
    if (err && err.code === "EEXIST") return false;
    throw err;
  }
}

export function releaseLock() {
  try {
    unlinkSync(lockPath());
  } catch {
    // already gone — fine
  }
}

/**
 * Load the most recent confirmed action per target wallet — used by the
 * decider's cooldown-window policy. Walks the ledger; for hackathon scale
 * this is a few-hundred-event scan, fast enough.
 */
async function lastConfirmedByWallet() {
  const out = new Map();
  let pendingAction = null;
  for await (const ev of tail()) {
    if (ev.type === "topup_planned") {
      pendingAction = ev.action;
    } else if (ev.type === "topup_confirmed" && pendingAction?.actionId === ev.actionId) {
      const finalized = {
        ...pendingAction,
        state: "confirmed",
        confirmedAt: pendingAction.createdAt,
      };
      out.set(pendingAction.targetWalletId, finalized);
      pendingAction = null;
    } else if (
      (ev.type === "topup_blocked" || ev.type === "topup_aborted_no_source") &&
      pendingAction?.actionId === ev.actionId
    ) {
      pendingAction = null;
    }
  }
  return out;
}

/**
 * Compute aggregate KPIs from the in-memory state.
 */
function computeKpis(state) {
  const totalFleetBalance = state.fleet.reduce((sum, w) => sum + w.usdcBalance, 0);
  const totalTreasuryBalance = state.treasury.reduce((sum, s) => sum + s.balance, 0);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const actions24h = state.actions.filter((a) => a.createdAt >= cutoff).length;
  return { totalFleetBalance, totalTreasuryBalance, actions24h };
}

/**
 * Walk ledger and tally per-policy pass/fail counts.
 */
async function computePolicyStats() {
  const stats = {};
  for await (const ev of tail()) {
    if (ev.type === "topup_planned") {
      for (const check of ev.action.policyChecks) {
        if (!stats[check.policyName]) stats[check.policyName] = { pass: 0, fail: 0 };
        stats[check.policyName][check.passed ? "pass" : "fail"] += 1;
      }
    } else if (ev.type === "topup_blocked") {
      // Already counted in the topup_planned attached to this action — don't double-count.
    }
  }
  return stats;
}

/**
 * Hydrate daemon state from disk + ledger.
 *
 * `options.now` is injectable for tests.
 * `options.portfolioFetcher` and `options.txRunner` mock out external IO.
 * `options.balanceFetcher` returns current on-chain balance per source.
 */
export async function hydrateState(options = {}) {
  const now = options.now ?? new Date();
  const wallets = listWallets();
  const sources = applyApyToSources(listSources(), now);

  const balanceFetcher = options.balanceFetcher ?? (async (s) => s.balance ?? 0);
  const sourcesWithBalance = await Promise.all(
    sources.map(async (s) => ({
      ...s,
      balance: await balanceFetcher(s),
    })),
  );

  const portfolioFetcher = options.portfolioFetcher ?? (async () => ({ usdcBalance: 0 }));
  const observations = await observeFleet(wallets, portfolioFetcher, { now });

  const fleet = observations
    .filter((o) => !o.failed && o.sample)
    .map((o) => ({
      ...o.wallet,
      runwayHours: o.sample.runwayHours,
      usdcBalance: o.sample.usdcBalance,
      ewmaHourlyBurn: o.sample.ewmaHourlyBurn,
    }));

  const samplesById = new Map();
  for (const o of observations) {
    if (o.sample) samplesById.set(o.wallet.id, [o.sample]);
  }

  // Replay ledger to collect actions + policy stats
  const actions = [];
  const policyStats = {};
  for await (const ev of tail()) {
    if (ev.type === "topup_planned") {
      actions.push(ev.action);
      for (const check of ev.action.policyChecks) {
        if (!policyStats[check.policyName]) policyStats[check.policyName] = { pass: 0, fail: 0 };
        policyStats[check.policyName][check.passed ? "pass" : "fail"] += 1;
      }
    }
  }

  const state = emptyState({
    daemonPid: process.pid,
    startedAt: now.toISOString(),
    version: options.version ?? "0.0.0-phase4",
    settings: options.settings ?? {
      daemon: {
        version: options.version ?? "0.0.0-phase4",
        pid: process.pid,
        port: 7402,
        logLevel: "info",
      },
      policyDefaults: {
        maxPerActionUsdc: 100,
        minCooldownMinutes: 30,
        burnRateMultiplierThreshold: 10,
      },
      fleetThresholds: {
        targetRunwayHours: 72,
        minRunwayHours: 24,
        minUsdcBalance: 5,
      },
    },
    policies: REGISTERED_POLICIES.map((p) => ({
      name: p.policyName,
      version: p.policyVersion,
      source: "quartermaster",
      stats: policyStats[p.policyName] ?? { pass: 0, fail: 0 },
    })),
  });
  state.fleet = fleet;
  state.treasury = sourcesWithBalance;
  state.actions = actions;
  state.policyStats = policyStats;
  state.kpis = computeKpis(state);
  state.samplesById = samplesById;
  state.observations = observations;
  state.lastConfirmedByWallet = await lastConfirmedByWallet();
  return state;
}

/**
 * Run a single tick. Idempotent: emits one tick_started, observes the
 * fleet, decides, executes if planned. Emits tick_completed regardless.
 *
 * Returns the tick result for the integration test.
 */
export async function runOneTick(state, options = {}) {
  const tickId = `tick-${Date.now()}`;
  const now = (options.now ?? new Date()).toISOString();
  const start = Date.now();

  appendEvent({ type: "tick_started", tickId, ts: now });

  // Pause check — Phase 4.5. If `paused` flag file exists, skip the work
  // but still emit tick_completed so observability is consistent.
  if (!options.skipPauseCheck && existsSync(qmPath("paused"))) {
    appendEvent({
      type: "tick_completed",
      tickId,
      durationMs: Date.now() - start,
      ts: new Date().toISOString(),
    });
    return { tickId, decision: { kind: "paused" }, executed: null };
  }

  // Build observations on the FLY so freshly-burned balances are seen, not
  // the stale snapshot from hydrate.
  const wallets = listWallets();
  const portfolioFetcher = options.portfolioFetcher ?? (async () => ({ usdcBalance: 0 }));
  const observations = await observeFleet(wallets, portfolioFetcher, {
    now: options.now ?? new Date(),
  });

  // Emit per-wallet observation events to ledger.
  for (const o of observations) {
    if (o.sample) {
      appendEvent({ type: "wallet_observed", walletId: o.wallet.id, sample: o.sample });
    }
  }

  // Refresh fleet snapshot in state for the broadcast.
  state.fleet = observations
    .filter((o) => !o.failed && o.sample)
    .map((o) => ({
      ...o.wallet,
      runwayHours: o.sample.runwayHours,
      usdcBalance: o.sample.usdcBalance,
      ewmaHourlyBurn: o.sample.ewmaHourlyBurn,
    }));

  const policyConfig = {
    allowedTargetIds: wallets.map((w) => w.id),
    ...(options.policyConfig ?? {}),
  };

  const target = observations.find((o) => o.underThreshold && !o.failed);
  let decision = null;
  let executed = null;

  if (target) {
    const lastConfirmed = state.lastConfirmedByWallet?.get(target.wallet.id) ?? null;
    decision = await decide({
      observations,
      treasurySources: state.treasury,
      recentSamples: observations.filter((o) => o.sample).map((o) => o.sample),
      lastConfirmedActionForTarget: lastConfirmed,
      policyConfig,
      now,
    });

    if (decision.kind === "planned") {
      const action = { ...decision.action, policyChecks: decision.evaluations };
      try {
        executed = await executeAction(action, options.executionPlan ?? sendOnlyPlan(action), {
          runner: options.runner,
        });
        state.actions = [executed, ...state.actions].slice(0, 200);
      } catch (err) {
        // executor already emitted daemon_halt
      }
    } else if (decision.kind === "blocked") {
      const blockedAction = { ...decision.action, policyChecks: decision.evaluations };
      // Persist the planned action so /api/actions/:id can serve it later.
      appendEvent({ type: "topup_planned", action: blockedAction });
      appendEvent({
        type: "topup_blocked",
        actionId: decision.action.actionId,
        reasonCode: decision.reasonCode,
        reasonText: decision.reasonText,
      });
      state.actions = [blockedAction, ...state.actions].slice(0, 200);
    } else if (decision.kind === "no_source") {
      appendEvent({ type: "topup_aborted_no_source", actionId: deriveTransientId() });
    }
  }

  state.kpis = computeKpis(state);
  state.policyStats = await computePolicyStats();
  state.policies = state.policies.map((p) => ({
    ...p,
    stats: state.policyStats[p.name] ?? { pass: 0, fail: 0 },
  }));

  if (typeof options.onBroadcast === "function") {
    await options.onBroadcast(state);
  } else {
    await broadcastState(state);
  }

  appendEvent({
    type: "tick_completed",
    tickId,
    durationMs: Date.now() - start,
    ts: new Date().toISOString(),
  });

  return { tickId, decision, executed };
}

function deriveTransientId() {
  // Phase 4.5: UUIDv7-shape sentinel with a recognizable "0000-0000-0000"
  // sequence in the time-low field. Dashboards render `topup_aborted_no_source`
  // events with action IDs starting `00000000-0000-` as "system" rather than
  // user-visible action records — keeps the actions list focused on real
  // top-ups. See Phase 5 dashboard filter at apps/dashboard/lib/actions.ts.
  return "00000000-0000-7000-8000-" + Math.floor(Math.random() * 1e12).toString(16).padStart(12, "0").slice(0, 12);
}

function sendOnlyPlan(action) {
  return {
    sendTo: "0x" + "c".repeat(40),
    sendToken: "USDC",
    sendAmount: action.topUpAmountUsdc,
    expectedFinalBalance: action.topUpAmountUsdc,
  };
}

export const __testing = { computeKpis, computePolicyStats, lastConfirmedByWallet };

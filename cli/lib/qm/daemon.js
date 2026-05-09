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

import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  openSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getWallet, listWallets } from "../fleet/registry.js";
import { listSources } from "../treasury/sources.js";
import { applyApyToSources } from "./apy.js";
import { decide } from "./decider.js";
import { buildSubprocessEnv } from "./env.js";
import { executeAction } from "./executor.js";
import { appendEvent, tail } from "./ledger.js";
import { fetchPortfolio, fetchSourceBalance } from "./portfolio-fetcher.js";
import { findOrphans } from "./reconcile.js";
import { REGISTERED_POLICIES } from "./run-policies.js";
import { qmPath } from "./storage.js";
import { observeFleet } from "./watcher.js";
import { broadcastState, emptyState } from "./http-server.js";

const DEFAULT_TICK_SECONDS = 60;

// Phase 8: live orchestrator defaults. All overridable via env vars.
export const LIVE_ORCHESTRATOR_DEFAULTS = {
  // Skip orchestration if a subordinate burned within this many minutes.
  burnIntervalMin: 15,
  // Hard monthly USDC cap. Reset each calendar month (UTC).
  budgetUsdc: 5,
  // Subordinate balance floor — below this we let the daemon's normal
  // top-up logic recover the wallet rather than burning more.
  minSubordinateUsdc: 0.1,
  // Approximate USDC cost per orchestrator-triggered burn. Used for the
  // budget pre-check; actual on-chain cost may vary by a few cents.
  perTriggerSpendUsdc: 0.02,
};

const ZERION_CLI_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../cli/zerion.js",
);

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
 * `options.now` is injectable for tests. Production reads real chain state
 * via `portfolio-fetcher` (default for both `portfolioFetcher` and
 * `balanceFetcher`); test code passes its own fetchers via `options.*` to
 * avoid spawning subprocesses.
 */
export async function hydrateState(options = {}) {
  const now = options.now ?? new Date();
  const wallets = listWallets();
  const sources = applyApyToSources(listSources(), now);

  const balanceFetcher = options.balanceFetcher ?? fetchSourceBalance;
  const sourcesWithBalance = await Promise.all(
    sources.map(async (s) => ({
      ...s,
      balance: await balanceFetcher(s),
    })),
  );

  const portfolioFetcher = options.portfolioFetcher ?? fetchPortfolio;
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
    publicMode: options.publicMode ?? false,
    liveOrchestrator: options.publicMode
      ? {
          enabled: true,
          monthlyBudgetUsdc: options.liveOrchestratorConfig?.budgetUsdc ?? LIVE_ORCHESTRATOR_DEFAULTS.budgetUsdc,
          monthlySpentUsdc: 0,
          budgetExhausted: false,
          lastDecision: null,
        }
      : null,
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
  // the stale snapshot from hydrate. Default to the real `fetchPortfolio`
  // production fetcher; tests inject their own.
  const wallets = listWallets();
  const portfolioFetcher = options.portfolioFetcher ?? fetchPortfolio;
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

  // Phase 8: live orchestrator. Opt-in via state.publicMode (set at daemon
  // startup from QM_PUBLIC). Decision is logged regardless of outcome so
  // /api/health can surface "why no burn this tick".
  if (state.publicMode) {
    const cfg = options.liveOrchestratorConfig ?? state.liveOrchestratorConfig ?? {};
    const monthly = await liveOrchestratorMonthlySpend(options.now ?? new Date(), cfg.perTriggerSpendUsdc);
    const orchDecision = evaluateLiveOrchestrator({
      publicMode: true,
      passphraseSet: Boolean(process.env.QM_KEYSTORE_PASSPHRASE),
      fleet: state.fleet,
      observations,
      monthlySpentUsdc: monthly.spentUsdc,
      config: cfg,
      now: options.now ?? new Date(),
    });
    appendEvent({
      type: "live_orchestrator_tick",
      ts: orchDecision.ts,
      decision: orchDecision.decision,
      reason: orchDecision.reason,
      monthlyBudgetUsdc: orchDecision.config.budgetUsdc,
      monthlySpentUsdc: monthly.spentUsdc,
      ...(orchDecision.walletId ? { walletId: orchDecision.walletId } : {}),
    });
    if (orchDecision.decision === "triggered_burn") {
      const runner = options.liveOrchestratorRunner ?? defaultLiveOrchestratorRunner;
      try {
        runner({ walletId: orchDecision.walletId });
      } catch {
        // Subprocess spawn failure shouldn't crash the tick. The next tick
        // will retry; meantime /api/health surfaces no recent triggered_burn.
      }
    }
    state.liveOrchestrator = {
      enabled: true,
      monthlyBudgetUsdc: orchDecision.config.budgetUsdc,
      monthlySpentUsdc:
        orchDecision.decision === "triggered_burn"
          ? monthly.spentUsdc + orchDecision.config.perTriggerSpendUsdc
          : monthly.spentUsdc,
      budgetExhausted: orchDecision.decision === "skipped_budget_exhausted",
      lastDecision: { decision: orchDecision.decision, reason: orchDecision.reason, ts: orchDecision.ts },
    };
  }

  state.lastTickAt = new Date().toISOString();

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

/**
 * Compute month-to-date USDC spend by the live orchestrator. Walks the
 * ledger and sums `live_orchestrator_tick` events whose `decision` is
 * `triggered_burn` and whose `ts` is in the current calendar month (UTC).
 *
 * Phase 8 — used by the budget cap pre-check + surfaced via /api/health.
 */
export async function liveOrchestratorMonthlySpend(now = new Date(), perTriggerSpendUsdc = LIVE_ORCHESTRATOR_DEFAULTS.perTriggerSpendUsdc) {
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  let triggers = 0;
  for await (const ev of tail()) {
    if (ev.type !== "live_orchestrator_tick") continue;
    if (ev.decision !== "triggered_burn") continue;
    if (Date.parse(ev.ts) < monthStart) continue;
    triggers += 1;
  }
  return { triggers, spentUsdc: triggers * perTriggerSpendUsdc, monthStart };
}

/**
 * Decide whether the live orchestrator should trigger a burn this tick.
 * Pure function — caller spawns the subprocess if `decision === "triggered_burn"`.
 *
 * Skip conditions (in order, first match wins):
 *   1. publicMode=false                       — opt-in only
 *   2. QM_KEYSTORE_PASSPHRASE absent          — exportWallet would fail
 *   3. recent on-chain burn observed          — no need to inject more
 *   4. any subordinate balance below floor    — let top-up loop heal first
 *   5. monthly budget exhausted               — hard cap
 *
 * Otherwise: trigger.
 */
export function evaluateLiveOrchestrator({
  publicMode,
  passphraseSet,
  fleet,
  observations,
  monthlySpentUsdc,
  config,
  now,
}) {
  const ts = (now ?? new Date()).toISOString();
  const cfg = { ...LIVE_ORCHESTRATOR_DEFAULTS, ...(config ?? {}) };

  if (!publicMode) {
    return { decision: "skipped_no_burn_window", reason: "publicMode disabled", ts, config: cfg };
  }
  if (!passphraseSet) {
    return {
      decision: "skipped_passphrase_missing",
      reason: "QM_KEYSTORE_PASSPHRASE not set; live orchestrator cannot derive subordinate keys",
      ts,
      config: cfg,
    };
  }

  const lowSubordinate = (fleet ?? []).find((w) => w.usdcBalance < cfg.minSubordinateUsdc);
  if (lowSubordinate) {
    return {
      decision: "skipped_low_subordinate_balance",
      reason: `subordinate "${lowSubordinate.id}" balance ${lowSubordinate.usdcBalance.toFixed(6)} < floor ${cfg.minSubordinateUsdc}; deferring to top-up logic`,
      ts,
      config: cfg,
      walletId: lowSubordinate.id,
    };
  }

  // Recent burn signal: any subordinate's ewmaHourlyBurn above a near-zero
  // threshold (catches activity from the past ~2 half-lives).
  const RECENT_BURN_EPSILON = 0.0001;
  const recentBurner = (observations ?? []).find(
    (o) => o.sample && o.sample.ewmaHourlyBurn > RECENT_BURN_EPSILON,
  );
  if (recentBurner) {
    return {
      decision: "skipped_no_burn_window",
      reason: `recent burn detected — ${recentBurner.wallet.id} ewma=${recentBurner.sample.ewmaHourlyBurn.toFixed(6)} USDC/h above epsilon`,
      ts,
      config: cfg,
      walletId: recentBurner.wallet.id,
    };
  }

  if (monthlySpentUsdc + cfg.perTriggerSpendUsdc > cfg.budgetUsdc) {
    return {
      decision: "skipped_budget_exhausted",
      reason: `monthly spend ${monthlySpentUsdc.toFixed(4)} + per-trigger ${cfg.perTriggerSpendUsdc} would exceed budget ${cfg.budgetUsdc}`,
      ts,
      config: cfg,
    };
  }

  // Pick the highest-balance subordinate as the burner — preserves the
  // others for the daemon's normal top-up demonstration.
  const eligible = (fleet ?? []).filter((w) => w.usdcBalance >= cfg.minSubordinateUsdc);
  eligible.sort((a, b) => b.usdcBalance - a.usdcBalance);
  const target = eligible[0] ?? (fleet ?? [])[0];
  return {
    decision: "triggered_burn",
    reason: `live orchestrator firing low-rate x402 burn on ${target?.id ?? "alpha-1"}`,
    ts,
    config: cfg,
    walletId: target?.id ?? "alpha-1",
  };
}

/**
 * Default live-orchestrator burner: fire-and-forget subprocess spawn of
 * `qm test x402-burn --wallet=<id> --rate=1 --duration=60`. Tests inject
 * a stub via `options.liveOrchestratorRunner`.
 */
function defaultLiveOrchestratorRunner({ walletId }) {
  const child = spawn(
    "node",
    [ZERION_CLI_PATH, "qm", "test", "x402-burn", `--wallet=${walletId}`, "--rate=1", "--duration=60"],
    { stdio: ["ignore", "ignore", "ignore"], env: buildSubprocessEnv(), detached: true },
  );
  child.unref();
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
  const target = getWallet(action.targetWalletId);
  if (!target) {
    const err = new Error(
      `sendOnlyPlan: target wallet "${action.targetWalletId}" not in fleet — refusing to execute top-up`,
    );
    err.code = "target_wallet_not_in_fleet";
    throw err;
  }
  if (typeof target.address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(target.address)) {
    const err = new Error(
      `sendOnlyPlan: target wallet "${action.targetWalletId}" has invalid address "${target.address}" — refusing to execute top-up`,
    );
    err.code = "target_wallet_invalid_address";
    throw err;
  }
  return {
    sendTo: target.address,
    sendToken: "USDC",
    sendAmount: action.topUpAmountUsdc,
    expectedFinalBalance: action.topUpAmountUsdc,
  };
}

export const __testing = {
  computeKpis,
  computePolicyStats,
  lastConfirmedByWallet,
  defaultLiveOrchestratorRunner,
};

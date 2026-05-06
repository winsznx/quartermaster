/**
 * Phase 4 integration test — one full happy-path tick cycle.
 *
 * Mocks: portfolioFetcher (no Zerion API), runner (no zerion subprocess).
 * Real: fleet + treasury registries on disk, ledger writes, decider, policy
 * dispatcher, executor state machine, http-server response shapes.
 *
 * Asserts the ledger event sequence matches PRD §6.2 happy path.
 */

import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { addWallet } from "../lib/fleet/registry.js";
import { addSource } from "../lib/treasury/sources.js";
import { hydrateState, runOneTick } from "../lib/qm/daemon.js";
import { readAll } from "../lib/qm/ledger.js";
import { buildApp } from "../lib/qm/http-server.js";

const VALID_WALLET_ADDR = "0x1234567890123456789012345678901234567890";
const VALID_TREASURY_ADDR = "0x9876543210987654321098765432109876543210";
const VALID_TX = "0x" + "a".repeat(64);

let sandbox;
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "qm-int-test-"));
  process.env.QM_HOME = sandbox;
});
afterEach(() => {
  delete process.env.QM_HOME;
  rmSync(sandbox, { recursive: true, force: true });
});

describe("integration — full happy-path tick cycle", () => {
  it("registers fleet + treasury, ticks once with mocked I/O, ledger has the right sequence", async () => {
    // 1) Register a wallet + a treasury source on disk.
    addWallet({
      id: "demo-1",
      address: VALID_WALLET_ADDR,
      chainId: "eip155:8453",
      targetRunwayHours: 72,
      minRunwayHours: 24,
      minUsdcBalance: 5,
      createdAt: "2026-05-01T00:00:00Z",
    });
    addSource({
      id: "usdc-idle",
      walletAddress: VALID_TREASURY_ADDR,
      chainId: "eip155:8453",
      assetContract: "native",
      symbol: "USDC",
      currentApyEstimate: 0,
      apyLastUpdated: "2026-05-06T11:00:00Z",
      minRetainedBalance: 0,
      priority: 1,
    });

    // 2) Pre-seed samples.jsonl with a 24h steady-state of 1 USDC/h burn
    //    so the next observation looks like normal usage, not a spike.
    //    Without this seed, any single hour of burn registers as a 24h+ spike
    //    against a 7d=0 baseline and burn-rate-oracle correctly rejects.
    const { appendFileSync, mkdirSync: mkdirSyncRaw } = await import("node:fs");
    const { dirname: dirnameRaw } = await import("node:path");
    const samplesPath = join(sandbox, "samples.jsonl");
    mkdirSyncRaw(dirnameRaw(samplesPath), { recursive: true });
    const seed = [
      {
        // 24h ago: balance 34, established steady ewma=1 (preserved as "previous-cycle")
        walletId: "demo-1",
        usdcBalance: 34,
        sampledAt: "2026-05-05T12:00:00Z",
        last24hSpend: 24,
        last7dSpend: 24,
        ewmaHourlyBurn: 1,
        runwayHours: 34,
      },
      {
        // 1h ago: balance 11, ewma still ~1
        walletId: "demo-1",
        usdcBalance: 11,
        sampledAt: "2026-05-06T11:00:00Z",
        last24hSpend: 23,
        last7dSpend: 23,
        ewmaHourlyBurn: 1,
        runwayHours: 11,
      },
    ];
    for (const s of seed) appendFileSync(samplesPath, `${JSON.stringify(s)}\n`);

    // Now mock the portfolio fetcher to return balance=10 (steady 1 USDC/h).
    const observedBalance = 10;
    const portfolioFetcher = async () => ({ usdcBalance: observedBalance });
    const balanceFetcher = async () => 1000;

    let state = await hydrateState({
      portfolioFetcher,
      balanceFetcher,
      now: new Date("2026-05-06T12:00:00Z"),
    });
    state.lastConfirmedByWallet = await (
      await import("../lib/qm/daemon.js")
    ).__testing.lastConfirmedByWallet();

    // 4) Mocked subprocess runner — returns a fake tx hash for the send leg.
    const mockedTxs = [];
    const runner = async (args) => {
      mockedTxs.push(args);
      return { txHash: VALID_TX };
    };

    // 5) Run a single tick at the same now so the observation reads as the
    //    "current" sample (1h after the last seed).
    const result = await runOneTick(state, {
      portfolioFetcher,
      runner,
      now: new Date("2026-05-06T12:00:00Z"),
      onBroadcast: async () => {}, // no-op (no SSE subscribers in this test)
    });

    // 6) Assertions — decision was planned and executed.
    assert.equal(result.decision.kind, "planned");
    assert.equal(result.executed.state, "confirmed");
    assert.equal(result.executed.txHashes.send, VALID_TX);

    // 7) Ledger sequence — must include the canonical happy-path events.
    const events = await readAll();
    const types = events.map((e) => e.type);
    assert.ok(types.includes("tick_started"), "missing tick_started");
    assert.ok(types.includes("wallet_observed"), "missing wallet_observed");
    assert.ok(types.includes("topup_planned"), "missing topup_planned");
    assert.ok(types.includes("topup_send_pending"), "missing topup_send_pending");
    assert.ok(types.includes("topup_send_confirmed"), "missing topup_send_confirmed");
    assert.ok(types.includes("topup_confirmed"), "missing topup_confirmed");
    assert.ok(types.includes("tick_completed"), "missing tick_completed");

    // 8) HTTP layer reflects the same state.
    state.actions = [result.executed]; // simulate the daemon attaching the executed action
    const app = buildApp(state);
    const stateRes = await app.fetch(new Request("http://test/api/state"));
    assert.equal(stateRes.status, 200);
    const stateBody = await stateRes.json();
    assert.ok(stateBody.fleet.length >= 1);

    const actionsRes = await app.fetch(new Request("http://test/api/actions"));
    const actionsBody = await actionsRes.json();
    assert.equal(actionsBody.actions[0].actionId, result.executed.actionId);
    assert.equal(actionsBody.actions[0].state, "confirmed");
  });

  it("blocked path — burn-rate spike triggers BURN_RATE_ANOMALY_DETECTED, action lands in /api/actions as state=blocked", async () => {
    addWallet({
      id: "demo-1",
      address: VALID_WALLET_ADDR,
      chainId: "eip155:8453",
      targetRunwayHours: 72,
      minRunwayHours: 24,
      minUsdcBalance: 5,
      createdAt: "2026-05-01T00:00:00Z",
    });
    addSource({
      id: "usdc-idle",
      walletAddress: VALID_TREASURY_ADDR,
      chainId: "eip155:8453",
      assetContract: "native",
      symbol: "USDC",
      currentApyEstimate: 0,
      apyLastUpdated: "2026-05-06T11:00:00Z",
      minRetainedBalance: 0,
      priority: 1,
    });

    // Pre-populate samples.jsonl with a 7d-of-1/h baseline + a current 11/h
    // spike. The fixture-driven path makes the decider see ewma=11 with 7d
    // baseline 1/h → 11x ratio → burn-rate-oracle rejects.
    const { appendFileSync, mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    const samplesPath = join(sandbox, "samples.jsonl");
    mkdirSync(dirname(samplesPath), { recursive: true });

    // Inject one synthetic sample at "now-1h" with low burn (establishes the
    // baseline + history)
    appendFileSync(
      samplesPath,
      JSON.stringify({
        walletId: "demo-1",
        usdcBalance: 100,
        sampledAt: "2026-05-06T11:00:00Z",
        last24hSpend: 24, // mean = 1/h
        last7dSpend: 168, // baseline = 1/h
        ewmaHourlyBurn: 1,
        runwayHours: 100,
      }) + "\n",
    );

    // Now observation drops balance hard — recent_hour_spend will be ~89,
    // ewma steps to 0.3*89 + 0.7*1 = 27.4 → 27.4x baseline → spike.
    const portfolioFetcher = async () => ({ usdcBalance: 11 });

    let state = await hydrateState({
      portfolioFetcher,
      balanceFetcher: async () => 1000,
      now: new Date("2026-05-06T11:00:00Z"),
    });
    state.lastConfirmedByWallet = new Map();

    const result = await runOneTick(state, {
      portfolioFetcher,
      runner: async () => ({ txHash: VALID_TX }),
      now: new Date("2026-05-06T12:00:00Z"),
      onBroadcast: async () => {},
    });

    assert.equal(result.decision.kind, "blocked");
    assert.equal(result.decision.reasonCode, "BURN_RATE_ANOMALY_DETECTED");
    assert.equal(result.decision.failedPolicy, "burn-rate-oracle");

    const events = await readAll();
    const types = events.map((e) => e.type);
    assert.ok(types.includes("topup_planned"), "blocked actions still ledger-record planned for /api/actions visibility");
    assert.ok(types.includes("topup_blocked"), "expected topup_blocked");
    assert.ok(!types.includes("topup_send_pending"), "blocked path must NOT send");
  });
});

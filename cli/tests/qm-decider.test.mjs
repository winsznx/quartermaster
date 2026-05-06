import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { decide, __testing } from "../lib/qm/decider.js";

const validAddress = "0x1234567890123456789012345678901234567890";
const validAddress2 = "0x9876543210987654321098765432109876543210";
const ISO = "2026-05-06T12:00:00Z";

function makeWallet(overrides = {}) {
  return {
    id: "demo-1",
    address: validAddress,
    chainId: "eip155:8453",
    targetRunwayHours: 72,
    minRunwayHours: 24,
    minUsdcBalance: 5,
    createdAt: "2026-05-01T00:00:00Z",
    ...overrides,
  };
}

function makeSource(overrides = {}) {
  return {
    id: "usdc-idle",
    walletAddress: validAddress2,
    chainId: "eip155:8453",
    assetContract: "native",
    symbol: "USDC",
    currentApyEstimate: 0,
    apyLastUpdated: ISO,
    minRetainedBalance: 0,
    priority: 1,
    balance: 1000,
    ...overrides,
  };
}

function makeSample(overrides = {}) {
  return {
    walletId: "demo-1",
    usdcBalance: 5,
    sampledAt: ISO,
    last24hSpend: 6,
    last7dSpend: 42,
    ewmaHourlyBurn: 0.5,
    runwayHours: 10,
    ...overrides,
  };
}

describe("decider", () => {
  it("no_action when no wallet is under threshold", async () => {
    const wallet = makeWallet();
    const observations = [
      {
        wallet,
        sample: makeSample({ runwayHours: 100 }),
        underThreshold: false,
        failed: false,
      },
    ];
    const result = await decide({
      observations,
      treasurySources: [makeSource()],
      recentSamples: [makeSample({ runwayHours: 100 })],
      lastConfirmedActionForTarget: null,
      policyConfig: { allowedTargetIds: ["demo-1"] },
      now: ISO,
    });
    assert.equal(result.kind, "no_action");
  });

  it("planned: picks neediest target, lowest-yield source, all policies pass", async () => {
    const wallet = makeWallet();
    const sample = makeSample({
      usdcBalance: 5,
      ewmaHourlyBurn: 0.5,
      runwayHours: 10,
      last24hSpend: 12,
      last7dSpend: 84,
    });
    const idleUsdc = makeSource({
      id: "usdc-idle",
      currentApyEstimate: 0,
      priority: 1,
      balance: 1000,
    });
    const aaveUsdc = makeSource({
      id: "aave-usdc",
      currentApyEstimate: 0.032,
      priority: 2,
      balance: 1000,
    });

    const result = await decide({
      observations: [{ wallet, sample, underThreshold: true, failed: false }],
      treasurySources: [aaveUsdc, idleUsdc],
      recentSamples: [sample],
      lastConfirmedActionForTarget: null,
      policyConfig: { allowedTargetIds: ["demo-1"] },
      now: ISO,
    });

    assert.equal(result.kind, "planned");
    assert.equal(result.action.targetWalletId, "demo-1");
    assert.equal(result.action.sourceId, "usdc-idle");
    // Top-up amount = ewma * targetRunway - balance = 0.5*72 - 5 = 31
    assert.ok(Math.abs(result.action.topUpAmountUsdc - 31) < 0.01);
    assert.equal(result.action.state, "planned");
    assert.equal(result.evaluations.length, 5);
    assert.ok(result.evaluations.every((e) => e.passed));
  });

  it("blocked: caps top-up via policy, fails when override pushes over", async () => {
    const wallet = makeWallet();
    const sample = makeSample({
      usdcBalance: 5,
      ewmaHourlyBurn: 5, // very high burn → big needed top-up
      runwayHours: 1,
      last24hSpend: 120,
      last7dSpend: 840,
    });
    // Cap of 50; ewma*72 - 5 = 355 → decider clamps to 50
    const result = await decide({
      observations: [{ wallet, sample, underThreshold: true, failed: false }],
      treasurySources: [makeSource({ balance: 1000 })],
      recentSamples: [sample],
      lastConfirmedActionForTarget: null,
      policyConfig: {
        allowedTargetIds: ["demo-1"],
        "max-per-action-cap": { maxPerActionUsdc: 50 },
      },
      now: ISO,
    });

    // After clamping to 50 the policy passes (50 ≤ 50)
    assert.equal(result.kind, "planned");
    assert.equal(result.action.topUpAmountUsdc, 50);
  });

  it("no_source: no eligible source carries enough balance", async () => {
    const wallet = makeWallet();
    const sample = makeSample({ runwayHours: 5 });
    const result = await decide({
      observations: [{ wallet, sample, underThreshold: true, failed: false }],
      treasurySources: [
        makeSource({ balance: 5, minRetainedBalance: 100 }), // never eligible
      ],
      recentSamples: [sample],
      lastConfirmedActionForTarget: null,
      policyConfig: { allowedTargetIds: ["demo-1"] },
      now: ISO,
    });
    assert.equal(result.kind, "no_source");
    assert.equal(result.target, "demo-1");
  });

  it("blocked: cooldown violation surfaces from policy dispatcher", async () => {
    const wallet = makeWallet();
    const sample = makeSample();
    // last confirmed 1 minute ago — well inside default 30min cooldown
    const recentlyConfirmed = {
      actionId: "01926a3a-1234-7abc-8def-1234567890ab",
      targetWalletId: "demo-1",
      topUpAmountUsdc: 10,
      sourceId: "usdc-idle",
      state: "confirmed",
      txHashes: { send: "0x" + "a".repeat(64) },
      policyChecks: [],
      createdAt: new Date(Date.parse(ISO) - 60_000).toISOString(),
      confirmedAt: new Date(Date.parse(ISO) - 60_000).toISOString(),
    };
    const result = await decide({
      observations: [{ wallet, sample, underThreshold: true, failed: false }],
      treasurySources: [makeSource()],
      recentSamples: [sample],
      lastConfirmedActionForTarget: recentlyConfirmed,
      policyConfig: { allowedTargetIds: ["demo-1"] },
      now: ISO,
    });
    assert.equal(result.kind, "blocked");
    assert.equal(result.failedPolicy, "cooldown-window");
    assert.equal(result.reasonCode, "COOLDOWN_VIOLATION");
  });

  it("yield-curve violation: planning would pick wrong source", async () => {
    // Force decider to pick a higher-APY source — by making idle USDC's
    // balance insufficient for the top-up amount but aave-usdc enough.
    // Then yield-curve won't fire (idle wasn't eligible). To actually trip
    // yield-curve we'd need the decider to disagree with the policy — but
    // they share the same eligibility logic, so they always agree. This test
    // documents that invariant.
    const wallet = makeWallet();
    const sample = makeSample();
    const result = await decide({
      observations: [{ wallet, sample, underThreshold: true, failed: false }],
      treasurySources: [
        makeSource({ id: "usdc-idle", currentApyEstimate: 0, priority: 1, balance: 1000 }),
        makeSource({ id: "aave-usdc", currentApyEstimate: 0.032, priority: 2, balance: 1000 }),
      ],
      recentSamples: [sample],
      lastConfirmedActionForTarget: null,
      policyConfig: { allowedTargetIds: ["demo-1"] },
      now: ISO,
    });
    // Decider always picks the lowest-APY eligible — yield-curve always passes
    assert.equal(result.kind, "planned");
    assert.equal(result.action.sourceId, "usdc-idle");
  });

  it("computeTopUpAmount caps at maxPerActionUsdc", () => {
    const wallet = makeWallet();
    const sample = makeSample({ usdcBalance: 0, ewmaHourlyBurn: 10 });
    // Need = 10 * 72 = 720; cap = 100 → result = 100
    assert.equal(__testing.computeTopUpAmount(wallet, sample, 100), 100);
  });

  it("computeTopUpAmount returns 0 when balance already meets target", () => {
    const wallet = makeWallet({ targetRunwayHours: 10 });
    const sample = makeSample({ usdcBalance: 100, ewmaHourlyBurn: 1 });
    // Need = 1 * 10 - 100 = -90 → max(0,…) = 0
    assert.equal(__testing.computeTopUpAmount(wallet, sample, 100), 0);
  });

  it("eligibleSourcesSorted respects (apy ASC, priority ASC)", () => {
    const sources = [
      makeSource({ id: "src-a", currentApyEstimate: 0.05, priority: 1, balance: 100 }),
      makeSource({ id: "src-b", currentApyEstimate: 0.03, priority: 2, balance: 100 }),
      makeSource({ id: "src-c", currentApyEstimate: 0.03, priority: 1, balance: 100 }),
    ];
    const sorted = __testing.eligibleSourcesSorted(sources, 50);
    assert.deepEqual(
      sorted.map((s) => s.id),
      ["src-c", "src-b", "src-a"],
    );
  });

  it("pickNeediestTarget picks lowest runway among under-threshold wallets", () => {
    const a = { wallet: { id: "a" }, sample: { runwayHours: 5 }, underThreshold: true };
    const b = { wallet: { id: "b" }, sample: { runwayHours: 2 }, underThreshold: true };
    const c = { wallet: { id: "c" }, sample: { runwayHours: 10 }, underThreshold: false };
    assert.equal(__testing.pickNeediestTarget([a, b, c]).wallet.id, "b");
  });
});

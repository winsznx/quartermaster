/**
 * Layer-1 policy tests — PRD §25.2.
 *
 * Every policy gets the 5 mandatory patterns:
 *   1. known-good context → ok: true
 *   2. boundary at threshold → ok: true
 *   3. just-over threshold → ok: false (with expected reasonCode)
 *   4. extreme anomalous → ok: false
 *   5. malformed context → ok: false (MALFORMED_CONTEXT)
 *
 * Plus burn-rate-oracle's three-check breakdown and a composition test that
 * runs all 5 through cli/lib/qm/run-policies.js.
 *
 * NOT an upstream test. Phase 3.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { REASON_CODES } from "@quartermaster/shared-schemas";

import * as allowlist from "../policies/allowlist.mjs";
import * as maxPerActionCap from "../policies/max-per-action-cap.mjs";
import * as cooldownWindow from "../policies/cooldown-window.mjs";
import * as burnRateOracle from "../policies/burn-rate-oracle.mjs";
import * as yieldCurvePreservation from "../policies/yield-curve-preservation.mjs";
import { runPolicies, REGISTERED_POLICIES } from "../lib/qm/run-policies.js";

// ---------- fixtures ----------

const validAddress = "0x1234567890123456789012345678901234567890";
const validAddress2 = "0x9876543210987654321098765432109876543210";
const validAddress3 = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const validTxHash = "0x" + "a".repeat(64);
const validUuid = "01926a3a-1234-7abc-8def-1234567890ab";
const ISO_NOW = "2026-05-06T12:00:00Z";

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

function makeAction(overrides = {}) {
  return {
    actionId: validUuid,
    targetWalletId: "demo-1",
    topUpAmountUsdc: 10,
    sourceId: "usdc-idle",
    state: "planned",
    txHashes: {},
    policyChecks: [],
    createdAt: ISO_NOW,
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
    currentApyEstimate: 0.0,
    apyLastUpdated: "2026-05-06T11:00:00Z",
    minRetainedBalance: 100,
    priority: 1,
    balance: 1000,
    ...overrides,
  };
}

function makeSample(overrides = {}) {
  return {
    walletId: "demo-1",
    usdcBalance: 5,
    sampledAt: ISO_NOW,
    last24hSpend: 6.0, // → meanHourly24h = 0.25 USDC/h
    last7dSpend: 42, // → baseline7dHourly ≈ 0.25 USDC/h
    ewmaHourlyBurn: 0.5, // → 2x baseline (well under 10x default threshold)
    runwayHours: 10, // < minRunwayHours (24) so check 3 passes
    ...overrides,
  };
}

function makeContext(overrides = {}) {
  const base = {
    proposedAction: makeAction(),
    targetWallet: makeWallet(),
    selectedSource: makeSource(),
    allEligibleSources: [makeSource()],
    recentSamples: [makeSample()],
    lastConfirmedActionForTarget: null,
    policyConfig: { allowedTargetIds: ["demo-1"] },
    now: ISO_NOW,
  };
  return { ...base, ...overrides };
}

// ---------- allowlist ----------

describe("policy: allowlist (decider-time)", () => {
  it("[1] known-good — target in allowlist → ok", async () => {
    const r = await allowlist.evaluate(makeContext());
    assert.deepEqual(r, { ok: true });
  });

  it("[2] boundary — only one allowed id, exactly matching → ok", async () => {
    const r = await allowlist.evaluate(
      makeContext({ policyConfig: { allowedTargetIds: ["demo-1"] } }),
    );
    assert.equal(r.ok, true);
  });

  it("[3] just-over — target id not in list → NOT_IN_FLEET", async () => {
    const r = await allowlist.evaluate(
      makeContext({ policyConfig: { allowedTargetIds: ["other"] } }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.NOT_IN_FLEET);
  });

  it("[4] extreme — empty allowlist → MALFORMED_CONTEXT", async () => {
    const r = await allowlist.evaluate(
      makeContext({ policyConfig: { allowedTargetIds: [] } }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.MALFORMED_CONTEXT);
  });

  it("[5] malformed — missing proposedAction → MALFORMED_CONTEXT", async () => {
    const ctx = makeContext();
    delete ctx.proposedAction;
    const r = await allowlist.evaluate(ctx);
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.MALFORMED_CONTEXT);
  });
});

// ---------- max-per-action-cap ----------

describe("policy: max-per-action-cap", () => {
  it("[1] known-good — amount under default cap → ok", async () => {
    const r = await maxPerActionCap.evaluate(
      makeContext({ proposedAction: makeAction({ topUpAmountUsdc: 10 }) }),
    );
    assert.equal(r.ok, true);
  });

  it("[2] boundary — exactly at default cap (100) → ok", async () => {
    const r = await maxPerActionCap.evaluate(
      makeContext({ proposedAction: makeAction({ topUpAmountUsdc: 100 }) }),
    );
    assert.equal(r.ok, true);
  });

  it("[3] just-over — 100.01 USDC against default cap → CAP_EXCEEDED", async () => {
    const r = await maxPerActionCap.evaluate(
      makeContext({ proposedAction: makeAction({ topUpAmountUsdc: 100.01 }) }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.CAP_EXCEEDED);
  });

  it("[4] extreme — 50_000 USDC top-up → CAP_EXCEEDED", async () => {
    const r = await maxPerActionCap.evaluate(
      makeContext({ proposedAction: makeAction({ topUpAmountUsdc: 50_000 }) }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.CAP_EXCEEDED);
  });

  it("[5] malformed — wrong types → MALFORMED_CONTEXT", async () => {
    const r = await maxPerActionCap.evaluate({
      proposedAction: { topUpAmountUsdc: "not-a-number" },
    });
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.MALFORMED_CONTEXT);
  });

  it("respects custom cap from policyConfig", async () => {
    const r = await maxPerActionCap.evaluate(
      makeContext({
        proposedAction: makeAction({ topUpAmountUsdc: 60 }),
        policyConfig: { maxPerActionUsdc: 50 },
      }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.CAP_EXCEEDED);
  });
});

// ---------- cooldown-window ----------

describe("policy: cooldown-window", () => {
  function makeLastConfirmed(confirmedAtIso) {
    return makeAction({
      state: "confirmed",
      confirmedAt: confirmedAtIso,
      txHashes: { send: validTxHash },
    });
  }

  it("[1] known-good — first-ever top-up (lastConfirmed=null) → ok", async () => {
    const r = await cooldownWindow.evaluate(
      makeContext({ lastConfirmedActionForTarget: null }),
    );
    assert.equal(r.ok, true);
  });

  it("[2] boundary — exactly cooldownMinutes elapsed → ok", async () => {
    // now = ISO_NOW; confirmedAt = 30 min before
    const past = new Date(Date.parse(ISO_NOW) - 30 * 60_000).toISOString();
    const r = await cooldownWindow.evaluate(
      makeContext({ lastConfirmedActionForTarget: makeLastConfirmed(past) }),
    );
    assert.equal(r.ok, true);
  });

  it("[3] just-over — 29 minutes elapsed → COOLDOWN_VIOLATION", async () => {
    const past = new Date(Date.parse(ISO_NOW) - 29 * 60_000).toISOString();
    const r = await cooldownWindow.evaluate(
      makeContext({ lastConfirmedActionForTarget: makeLastConfirmed(past) }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.COOLDOWN_VIOLATION);
  });

  it("[4] extreme — confirmed 1 second ago → COOLDOWN_VIOLATION", async () => {
    const past = new Date(Date.parse(ISO_NOW) - 1_000).toISOString();
    const r = await cooldownWindow.evaluate(
      makeContext({ lastConfirmedActionForTarget: makeLastConfirmed(past) }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.COOLDOWN_VIOLATION);
  });

  it("[5] malformed — lastConfirmed has no confirmedAt → MALFORMED_CONTEXT", async () => {
    // Build an action that is structurally valid (state still 'planned') but
    // missing confirmedAt — that's what the policy guards against.
    const badLast = makeAction({ state: "planned" });
    delete badLast.confirmedAt;
    const r = await cooldownWindow.evaluate(
      makeContext({ lastConfirmedActionForTarget: badLast }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.MALFORMED_CONTEXT);
  });

  it("custom cooldown applies — 60 min, 45 elapsed → COOLDOWN_VIOLATION", async () => {
    const past = new Date(Date.parse(ISO_NOW) - 45 * 60_000).toISOString();
    const r = await cooldownWindow.evaluate(
      makeContext({
        lastConfirmedActionForTarget: makeLastConfirmed(past),
        policyConfig: { minCooldownMinutes: 60 },
      }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.COOLDOWN_VIOLATION);
  });
});

// ---------- burn-rate-oracle ----------

describe("policy: burn-rate-oracle", () => {
  it("[1] known-good — sustained burn, 2x baseline, runway 10h < 24h → ok", async () => {
    const r = await burnRateOracle.evaluate(makeContext());
    assert.equal(r.ok, true);
  });

  it("[2] boundary — exactly 10x baseline at the spike threshold → ok", async () => {
    // baseline7dHourly = 1.0/h (last7dSpend = 168). recent EWMA = 10. ratio = 10. ≤ threshold → ok.
    const r = await burnRateOracle.evaluate(
      makeContext({
        recentSamples: [
          makeSample({
            last7dSpend: 168,
            last24hSpend: 24,
            ewmaHourlyBurn: 10,
            usdcBalance: 5,
          }),
        ],
      }),
    );
    assert.equal(r.ok, true);
  });

  it("[3] just-over — 10.01x baseline → BURN_RATE_ANOMALY_DETECTED", async () => {
    const r = await burnRateOracle.evaluate(
      makeContext({
        recentSamples: [
          makeSample({
            last7dSpend: 168, // baseline = 1/h
            last24hSpend: 24,
            ewmaHourlyBurn: 10.01, // 10.01x baseline
            usdcBalance: 5,
          }),
        ],
      }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.BURN_RATE_ANOMALY_DETECTED);
  });

  it("[4] extreme — zero 24h spend → NO_SUSTAINED_BURN", async () => {
    const r = await burnRateOracle.evaluate(
      makeContext({
        recentSamples: [
          makeSample({ last24hSpend: 0, last7dSpend: 0, ewmaHourlyBurn: 0 }),
        ],
      }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.NO_SUSTAINED_BURN);
  });

  it("[5] malformed — recentSamples empty → MALFORMED_CONTEXT", async () => {
    const r = await burnRateOracle.evaluate(makeContext({ recentSamples: [] }));
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.MALFORMED_CONTEXT);
  });

  describe("three checks in detail", () => {
    it("check 3 — runway above minRunwayHours → RUNWAY_NOT_BELOW_THRESHOLD", async () => {
      // ewmaHourlyBurn=0.1, usdcBalance=10 → projectedRunway=100h > 24h threshold
      const r = await burnRateOracle.evaluate(
        makeContext({
          recentSamples: [
            makeSample({
              last24hSpend: 2.4, // mean = 0.1/h > 0.01 floor (passes check 1)
              last7dSpend: 16.8, // baseline = 0.1/h, ratio = 1 (passes check 2)
              ewmaHourlyBurn: 0.1,
              usdcBalance: 10,
            }),
          ],
        }),
      );
      assert.equal(r.ok, false);
      assert.equal(r.reasonCode, REASON_CODES.RUNWAY_NOT_BELOW_THRESHOLD);
    });

    it("scenario: 7d of 1/h then a single 11x spike → BURN_RATE_ANOMALY_DETECTED", async () => {
      // After 168 prior steps with α=0.3 the EWMA converges to ~1; one step
      // with input 11 → 0.3*11 + 0.7*1 = 4.0. That's 4x baseline → still
      // under 10x threshold. So a spike alone after one tick won't trip
      // check 2; we need a sustained 11/h. Test against the stronger case:
      // ewmaHourlyBurn already at 11 (sustained) with 1/h baseline.
      const r = await burnRateOracle.evaluate(
        makeContext({
          recentSamples: [
            makeSample({
              last7dSpend: 168, // baseline = 1/h
              last24hSpend: 11 * 24, // mean = 11/h (passes check 1)
              ewmaHourlyBurn: 11, // 11x baseline → fails check 2
              usdcBalance: 5,
            }),
          ],
        }),
      );
      assert.equal(r.ok, false);
      assert.equal(r.reasonCode, REASON_CODES.BURN_RATE_ANOMALY_DETECTED);
    });

    it("scenario: real ramp — sustained 4/h vs 7d baseline 0.5/h → ok (8x ≤ 10x)", async () => {
      const r = await burnRateOracle.evaluate(
        makeContext({
          recentSamples: [
            makeSample({
              last7dSpend: 0.5 * 24 * 7, // baseline = 0.5/h
              last24hSpend: 4 * 24, // mean = 4/h
              ewmaHourlyBurn: 4, // 4 / 0.5 = 8x ≤ 10x → check 2 passes
              usdcBalance: 5,
            }),
          ],
        }),
      );
      assert.equal(r.ok, true);
    });

    it("respects custom spike_threshold", async () => {
      const r = await burnRateOracle.evaluate(
        makeContext({
          recentSamples: [
            makeSample({
              last7dSpend: 168,
              last24hSpend: 24 * 5,
              ewmaHourlyBurn: 5, // 5x baseline
              usdcBalance: 5,
            }),
          ],
          policyConfig: { spike_threshold: 4 }, // threshold tightened
        }),
      );
      assert.equal(r.ok, false);
      assert.equal(r.reasonCode, REASON_CODES.BURN_RATE_ANOMALY_DETECTED);
    });
  });
});

// ---------- yield-curve-preservation ----------

describe("policy: yield-curve-preservation", () => {
  const idleUsdc = makeSource({
    id: "usdc-idle",
    currentApyEstimate: 0.0,
    priority: 1,
    balance: 1000,
    minRetainedBalance: 100,
  });
  const aaveUsdc = makeSource({
    id: "aave-usdc",
    currentApyEstimate: 0.032,
    priority: 2,
    balance: 1000,
    minRetainedBalance: 0,
  });
  const stEth = makeSource({
    id: "steth",
    currentApyEstimate: 0.034,
    priority: 3,
    balance: 1000,
    minRetainedBalance: 0,
  });

  it("[1] known-good — selected idle USDC (lowest APY) → ok", async () => {
    const r = await yieldCurvePreservation.evaluate(
      makeContext({
        selectedSource: idleUsdc,
        allEligibleSources: [idleUsdc, aaveUsdc, stEth],
      }),
    );
    assert.equal(r.ok, true);
  });

  it("[2] boundary — APY tie broken by lower priority → ok", async () => {
    const a = makeSource({ id: "src-a", currentApyEstimate: 0.032, priority: 1, balance: 1000, minRetainedBalance: 0 });
    const b = makeSource({ id: "src-b", currentApyEstimate: 0.032, priority: 2, balance: 1000, minRetainedBalance: 0 });
    const r = await yieldCurvePreservation.evaluate(
      makeContext({ selectedSource: a, allEligibleSources: [b, a] }),
    );
    assert.equal(r.ok, true);
  });

  it("[3] just-over — picked aaveUsdc when idleUsdc was eligible → YIELD_CURVE_VIOLATION", async () => {
    const r = await yieldCurvePreservation.evaluate(
      makeContext({
        selectedSource: aaveUsdc,
        allEligibleSources: [idleUsdc, aaveUsdc, stEth],
      }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.YIELD_CURVE_VIOLATION);
  });

  it("[4] extreme — picked stETH when idle USDC could cover → YIELD_CURVE_VIOLATION", async () => {
    const r = await yieldCurvePreservation.evaluate(
      makeContext({
        selectedSource: stEth,
        allEligibleSources: [idleUsdc, aaveUsdc, stEth],
      }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.YIELD_CURVE_VIOLATION);
  });

  it("[5] malformed — allEligibleSources empty → MALFORMED_CONTEXT", async () => {
    const r = await yieldCurvePreservation.evaluate(
      makeContext({ allEligibleSources: [] }),
    );
    assert.equal(r.ok, false);
    assert.equal(r.reasonCode, REASON_CODES.MALFORMED_CONTEXT);
  });

  it("filters out sources that cannot cover topUpAmount + minRetainedBalance", async () => {
    // idle has 100 balance, minRetained 100 — cannot cover any top-up. aave can.
    const idleTooSmall = makeSource({
      id: "usdc-idle",
      currentApyEstimate: 0.0,
      priority: 1,
      balance: 100,
      minRetainedBalance: 100,
    });
    const aaveOk = makeSource({
      id: "aave-usdc",
      currentApyEstimate: 0.032,
      priority: 2,
      balance: 1000,
      minRetainedBalance: 0,
    });
    const r = await yieldCurvePreservation.evaluate(
      makeContext({
        proposedAction: makeAction({ topUpAmountUsdc: 50 }),
        selectedSource: aaveOk,
        allEligibleSources: [idleTooSmall, aaveOk],
      }),
    );
    assert.equal(r.ok, true);
  });
});

// ---------- composition ----------

describe("composition: cli/lib/qm/run-policies.js", () => {
  it("registers exactly the 5 layer-1 policies in the locked order", () => {
    assert.deepEqual(
      REGISTERED_POLICIES.map((p) => p.policyName),
      [
        "allowlist",
        "max-per-action-cap",
        "cooldown-window",
        "burn-rate-oracle",
        "yield-curve-preservation",
      ],
    );
  });

  it("happy path — all 5 pass", async () => {
    const result = await runPolicies(makeContext());
    assert.equal(result.ok, true);
    assert.equal(result.evaluations.length, 5);
    assert.ok(result.evaluations.every((e) => e.passed));
  });

  it("short-circuits on first failure (max-per-action-cap, position 2)", async () => {
    const ctx = makeContext({
      proposedAction: makeAction({ topUpAmountUsdc: 200 }),
    });
    const result = await runPolicies(ctx);
    assert.equal(result.ok, false);
    assert.equal(result.failedPolicy, "max-per-action-cap");
    assert.equal(result.reasonCode, REASON_CODES.CAP_EXCEEDED);
    // Short-circuit means we evaluated allowlist + cap, NOT the rest
    assert.equal(result.evaluations.length, 2);
    assert.equal(result.evaluations[0].passed, true);
    assert.equal(result.evaluations[1].passed, false);
  });

  it("policyConfig namespacing — bucket reaches the right policy only", async () => {
    // Tighten cap to 5 via namespaced bucket; other policies should not see this
    const ctx = makeContext({
      proposedAction: makeAction({ topUpAmountUsdc: 6 }),
      policyConfig: {
        allowedTargetIds: ["demo-1"],
        "max-per-action-cap": { maxPerActionUsdc: 5 },
      },
    });
    const result = await runPolicies(ctx);
    assert.equal(result.ok, false);
    assert.equal(result.failedPolicy, "max-per-action-cap");
    assert.equal(result.reasonCode, REASON_CODES.CAP_EXCEEDED);
  });

  it("invokes onEvaluation hook for every evaluated policy", async () => {
    const seen = [];
    await runPolicies(makeContext(), {
      onEvaluation: (check) => seen.push(check.policyName),
    });
    assert.deepEqual(seen, [
      "allowlist",
      "max-per-action-cap",
      "cooldown-window",
      "burn-rate-oracle",
      "yield-curve-preservation",
    ]);
  });

  it("evaluations attached match PolicyCheck shape (PRD §7)", async () => {
    const result = await runPolicies(makeContext());
    for (const e of result.evaluations) {
      assert.equal(typeof e.policyName, "string");
      assert.equal(typeof e.passed, "boolean");
      assert.equal(typeof e.evaluatedAt, "string");
    }
  });
});

// ---------- two-layer regression guard ----------

describe("two-layer architecture regression guard (PRD §8.0)", () => {
  it("layer 1 (ours) — exactly 5 policies registered in our dispatcher", () => {
    assert.equal(REGISTERED_POLICIES.length, 5);
  });

  it("layer 2 (upstream) — 3 policy files present and importable, each exports check()", async () => {
    const allowlistMod = await import("../cli/policies/allowlist.mjs");
    const denyApprovalsMod = await import("../cli/policies/deny-approvals.mjs");
    const denyTransfersMod = await import("../cli/policies/deny-transfers.mjs");
    assert.equal(typeof allowlistMod.check, "function");
    assert.equal(typeof denyApprovalsMod.check, "function");
    assert.equal(typeof denyTransfersMod.check, "function");
  });

  it("layers do NOT share contracts — upstream's check() takes a tx-shaped ctx, ours takes domain types", async () => {
    // Upstream's allowlist on a tx ctx → returns { allow }
    const upstream = await import("../cli/policies/allowlist.mjs");
    const upstreamResult = upstream.check({
      transaction: { to: validAddress },
      policy_config: { allowed_addresses: [validAddress] },
    });
    assert.equal(typeof upstreamResult.allow, "boolean");

    // Our allowlist on a domain ctx → returns { ok }
    const oursResult = await allowlist.evaluate(makeContext());
    assert.equal(typeof oursResult.ok, "boolean");
  });
});

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  Address,
  BurnRateSample,
  ChainId,
  HealthInfo,
  Kpis,
  LedgerEvent,
  PolicyStats,
  StateResponse,
  SubordinateWallet,
  TopUpAction,
  TreasurySource,
  WalletId,
  WalletWithDerived,
} from "../src/index.ts";

const validAddress = "0x1234567890123456789012345678901234567890";
const validTxHash = "0x" + "a".repeat(64);
const validIso = "2026-05-06T00:00:00Z";
const validUuid = "01926a3a-1234-7abc-8def-1234567890ab";

const exampleWallet = {
  id: "demo-1",
  address: validAddress,
  chainId: "eip155:8453",
  targetRunwayHours: 72,
  minRunwayHours: 24,
  minUsdcBalance: 5,
  createdAt: validIso,
};

const exampleSource = {
  id: "usdc-idle",
  walletAddress: validAddress,
  chainId: "eip155:8453",
  assetContract: validAddress,
  symbol: "USDC",
  currentApyEstimate: 0,
  apyLastUpdated: validIso,
  minRetainedBalance: 100,
  priority: 1,
};

const exampleAction = {
  actionId: validUuid,
  targetWalletId: "demo-1",
  topUpAmountUsdc: 10,
  sourceId: "usdc-idle",
  state: "confirmed",
  txHashes: { send: validTxHash },
  policyChecks: [
    { policyName: "max-per-action-cap", passed: true, evaluatedAt: validIso },
  ],
  createdAt: validIso,
  confirmedAt: validIso,
};

describe("primitives", () => {
  it("Address accepts valid hex", () => {
    assert.equal(Address.parse(validAddress), validAddress);
  });

  it("Address rejects bad hex length", () => {
    assert.throws(() => Address.parse("0x1234"));
  });

  it("ChainId accepts CAIP-2 EVM and Solana", () => {
    assert.equal(ChainId.parse("eip155:8453"), "eip155:8453");
    assert.equal(ChainId.parse("solana:mainnet"), "solana:mainnet");
  });

  it("ChainId rejects friendly names", () => {
    assert.throws(() => ChainId.parse("base"));
  });

  it("WalletId enforces character class", () => {
    assert.equal(WalletId.parse("demo-1"), "demo-1");
    assert.throws(() => WalletId.parse("DEMO-1"), /must be 2/);
    assert.throws(() => WalletId.parse("a"));
    assert.throws(() => WalletId.parse("a".repeat(33)));
  });
});

describe("SubordinateWallet round-trip", () => {
  it("parses a valid wallet", () => {
    assert.deepEqual(SubordinateWallet.parse(exampleWallet), exampleWallet);
  });

  it("rejects unknown keys (strict mode)", () => {
    assert.throws(() =>
      SubordinateWallet.parse({ ...exampleWallet, extra: "nope" }),
    );
  });

  it("rejects negative runway", () => {
    assert.throws(() =>
      SubordinateWallet.parse({ ...exampleWallet, targetRunwayHours: -1 }),
    );
  });
});

describe("TreasurySource round-trip", () => {
  it("parses a valid source", () => {
    assert.deepEqual(TreasurySource.parse(exampleSource), exampleSource);
  });

  it("accepts assetContract: 'native'", () => {
    assert.doesNotThrow(() =>
      TreasurySource.parse({ ...exampleSource, assetContract: "native" }),
    );
  });
});

describe("BurnRateSample round-trip", () => {
  it("parses a valid sample", () => {
    const sample = {
      walletId: "demo-1",
      usdcBalance: 12.5,
      sampledAt: validIso,
      last24hSpend: 4.2,
      last7dSpend: 28.0,
      ewmaHourlyBurn: 0.18,
      runwayHours: 70,
    };
    assert.deepEqual(BurnRateSample.parse(sample), sample);
  });
});

describe("TopUpAction round-trip", () => {
  it("parses a confirmed action", () => {
    assert.deepEqual(TopUpAction.parse(exampleAction), exampleAction);
  });

  it("accepts every state in the enum", () => {
    const states = [
      "planned",
      "swap_pending",
      "swap_confirmed",
      "bridge_pending",
      "bridge_confirmed",
      "send_pending",
      "confirmed",
      "blocked",
      "partial",
      "error",
    ];
    for (const state of states) {
      assert.doesNotThrow(() =>
        TopUpAction.parse({ ...exampleAction, state }),
      );
    }
  });

  it("rejects invalid state", () => {
    assert.throws(() => TopUpAction.parse({ ...exampleAction, state: "noop" }));
  });
});

describe("LedgerEvent discriminated union", () => {
  it("parses tick_started", () => {
    const ev = { type: "tick_started", tickId: "t-1", ts: validIso };
    assert.deepEqual(LedgerEvent.parse(ev), ev);
  });

  it("parses topup_confirmed", () => {
    const ev = {
      type: "topup_confirmed",
      actionId: validUuid,
      finalBalance: 22.5,
    };
    assert.deepEqual(LedgerEvent.parse(ev), ev);
  });

  it("parses topup_blocked with reasonCode", () => {
    const ev = {
      type: "topup_blocked",
      actionId: validUuid,
      reasonCode: "BURN_RATE_ANOMALY_DETECTED",
      reasonText: "10x baseline exceeded",
    };
    assert.deepEqual(LedgerEvent.parse(ev), ev);
  });

  it("rejects unknown event type", () => {
    assert.throws(() =>
      LedgerEvent.parse({ type: "bogus_event", ts: validIso }),
    );
  });

  it("covers every variant defined in PRD §7", () => {
    const requiredTypes = [
      "tick_started",
      "tick_skipped_overlap",
      "tick_completed",
      "wallet_observed",
      "topup_planned",
      "topup_blocked",
      "topup_swap_pending",
      "topup_swap_confirmed",
      "topup_bridge_pending",
      "topup_bridge_confirmed",
      "topup_send_pending",
      "topup_send_confirmed",
      "topup_confirmed",
      "topup_aborted_no_source",
      "daemon_halt",
      "daemon_panic",
      "agent_token_validated",
      "reconcile_started",
      "reconcile_resolved",
    ];
    const definedTypes = LedgerEvent.options.map((o) => o.shape.type.value);
    for (const t of requiredTypes) {
      assert.ok(definedTypes.includes(t), `LedgerEvent missing variant: ${t}`);
    }
  });
});

describe("API response shapes", () => {
  it("HealthInfo round-trip", () => {
    const h = {
      status: "ok",
      daemonPid: 12345,
      startedAt: validIso,
      version: "1.0.0",
    };
    assert.deepEqual(HealthInfo.parse(h), h);
  });

  it("Kpis round-trip", () => {
    const k = {
      totalFleetBalance: 49.1,
      totalTreasuryBalance: 6650,
      actions24h: 4,
    };
    assert.deepEqual(Kpis.parse(k), k);
  });

  it("PolicyStats round-trip", () => {
    const ps = {
      "max-per-action-cap": { pass: 142, fail: 2 },
      "burn-rate-oracle": { pass: 135, fail: 1 },
    };
    assert.deepEqual(PolicyStats.parse(ps), ps);
  });

  it("WalletWithDerived flattens BurnRateSample fields onto wallet", () => {
    const w = {
      ...exampleWallet,
      runwayHours: 70,
      usdcBalance: 12.5,
      ewmaHourlyBurn: 0.18,
    };
    assert.deepEqual(WalletWithDerived.parse(w), w);
  });

  it("StateResponse parses the full /api/state aggregate", () => {
    const state = {
      status: "ok",
      daemonPid: 12345,
      startedAt: validIso,
      version: "1.0.0",
      fleet: [
        {
          ...exampleWallet,
          runwayHours: 70,
          usdcBalance: 12.5,
          ewmaHourlyBurn: 0.18,
        },
      ],
      treasury: [{ ...exampleSource, balance: 450.0 }],
      actions: [exampleAction],
      kpis: {
        totalFleetBalance: 12.5,
        totalTreasuryBalance: 100,
        actions24h: 1,
      },
      policyStats: {
        allowlist: { pass: 1, fail: 0 },
      },
    };
    assert.deepEqual(StateResponse.parse(state), state);
  });
});

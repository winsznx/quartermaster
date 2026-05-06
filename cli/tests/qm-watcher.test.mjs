import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { observeFleet, observeWallet } from "../lib/qm/watcher.js";

const validAddress = "0x1234567890123456789012345678901234567890";

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

let sandbox;
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "qm-watcher-test-"));
  process.env.QM_HOME = sandbox;
});
afterEach(() => {
  delete process.env.QM_HOME;
  rmSync(sandbox, { recursive: true, force: true });
});

describe("watcher.observeWallet", () => {
  it("first observation: no history, ewma=0, runway is a large finite value (cold start)", async () => {
    const fetcher = async () => ({ usdcBalance: 100 });
    const sample = await observeWallet(makeWallet(), fetcher, {
      now: new Date("2026-05-06T12:00:00Z"),
    });
    assert.equal(sample.walletId, "demo-1");
    assert.equal(sample.usdcBalance, 100);
    assert.equal(sample.ewmaHourlyBurn, 0);
    // Cold start: runway is the 1e9 sentinel so underThreshold won't fire
    assert.equal(sample.runwayHours, 1e9);
  });

  it("second observation: balance dropped 5 USDC → recent=5, ewma=0.3*5=1.5", async () => {
    const fetcher1 = async () => ({ usdcBalance: 100 });
    await observeWallet(makeWallet(), fetcher1, {
      now: new Date("2026-05-06T11:00:00Z"),
    });
    const fetcher2 = async () => ({ usdcBalance: 95 });
    const sample = await observeWallet(makeWallet(), fetcher2, {
      now: new Date("2026-05-06T12:00:00Z"),
    });
    assert.equal(sample.usdcBalance, 95);
    // ewmaStep(0, 5, 0.3) = 1.5
    assert.equal(sample.ewmaHourlyBurn, 1.5);
    // runway = 95 / 1.5 ≈ 63.33h
    assert.ok(Math.abs(sample.runwayHours - 63.333) < 0.01, `expected ~63.33, got ${sample.runwayHours}`);
  });

  it("ignores increases in balance (top-ups don't reduce burn)", async () => {
    await observeWallet(makeWallet(), async () => ({ usdcBalance: 50 }), {
      now: new Date("2026-05-06T11:00:00Z"),
    });
    const sample = await observeWallet(
      makeWallet(),
      async () => ({ usdcBalance: 200 }),
      { now: new Date("2026-05-06T12:00:00Z") },
    );
    // balance increased → recent spend = 0 → ewma stays at 0 (was 0)
    assert.equal(sample.ewmaHourlyBurn, 0);
  });

  it("rolling 24h spend accumulates across multiple drops", async () => {
    await observeWallet(makeWallet(), async () => ({ usdcBalance: 100 }), {
      now: new Date("2026-05-06T08:00:00Z"),
    });
    await observeWallet(makeWallet(), async () => ({ usdcBalance: 90 }), {
      now: new Date("2026-05-06T09:00:00Z"),
    });
    await observeWallet(makeWallet(), async () => ({ usdcBalance: 80 }), {
      now: new Date("2026-05-06T10:00:00Z"),
    });
    const sample = await observeWallet(
      makeWallet(),
      async () => ({ usdcBalance: 75 }),
      { now: new Date("2026-05-06T11:00:00Z") },
    );
    // 100→90 (10), 90→80 (10), 80→75 (5) = 25 spent over 3h, all within 24h
    assert.equal(sample.last24hSpend, 25);
  });

  it("throws when fetcher returns invalid shape", async () => {
    await assert.rejects(
      () => observeWallet(makeWallet(), async () => ({ wrong: "shape" })),
      /usdcBalance/,
    );
  });
});

describe("watcher.observeFleet", () => {
  const ADDR_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const ADDR_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  it("observes every wallet and tags underThreshold correctly", async () => {
    const wallets = [
      makeWallet({ id: "drying", address: ADDR_A, minRunwayHours: 24 }),
      makeWallet({ id: "healthy", address: ADDR_B, minRunwayHours: 24 }),
    ];
    // First pass — establishes baseline (cold-start ewma=0, runway=1e9)
    await observeFleet(
      wallets,
      async (addr) => ({ usdcBalance: addr === ADDR_A ? 10 : 100 }),
      { now: new Date("2026-05-06T11:00:00Z") },
    );
    // Second pass — both burn 5
    const observations = await observeFleet(
      wallets,
      async (addr) => ({ usdcBalance: addr === ADDR_A ? 5 : 95 }),
      { now: new Date("2026-05-06T12:00:00Z") },
    );

    assert.equal(observations.length, 2);
    const drying = observations.find((o) => o.wallet.id === "drying");
    const healthy = observations.find((o) => o.wallet.id === "healthy");
    // drying: 10→5, ewma=0.3*5=1.5, runway=5/1.5≈3.33h < 24 → underThreshold
    assert.equal(drying.underThreshold, true);
    // healthy: 100→95, ewma=0.3*5=1.5, runway=95/1.5≈63h > 24 → not under
    assert.equal(healthy.underThreshold, false);
  });

  it("captures fetcher failures without short-circuiting the fleet", async () => {
    const wallets = [
      makeWallet({ id: "fa", address: ADDR_A }),
      makeWallet({ id: "fb", address: ADDR_B }),
    ];
    const fetcher = async (addr) => {
      if (addr === ADDR_A) throw new Error("rpc 503");
      return { usdcBalance: 100 };
    };
    const observations = await observeFleet(wallets, fetcher);
    assert.equal(observations[0].failed, true);
    assert.match(observations[0].error, /503/);
    assert.equal(observations[1].failed, false);
    assert.ok(observations[1].sample);
  });
});

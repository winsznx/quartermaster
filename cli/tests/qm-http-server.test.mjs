import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { buildApp, emptyState } from "../lib/qm/http-server.js";

const ISO = "2026-05-06T12:00:00Z";
const VALID_ADDR = "0x1234567890123456789012345678901234567890";
const VALID_ADDR2 = "0x9876543210987654321098765432109876543210";
const VALID_TX = "0x" + "a".repeat(64);
const VALID_UUID = "01926a3a-1234-7abc-8def-1234567890ab";

function makeState() {
  const state = emptyState({
    daemonPid: 12345,
    startedAt: ISO,
    version: "0.0.0-test",
    settings: {
      daemon: { version: "0.0.0-test", pid: 12345, port: 7402, logLevel: "info" },
      policyDefaults: { maxPerActionUsdc: 100, minCooldownMinutes: 30, burnRateMultiplierThreshold: 10 },
      fleetThresholds: { targetRunwayHours: 72, minRunwayHours: 24, minUsdcBalance: 5 },
    },
    policies: [
      { name: "allowlist", version: "1.0.0", source: "quartermaster", stats: { pass: 1, fail: 0 } },
    ],
  });
  state.fleet = [
    {
      id: "demo-1",
      address: VALID_ADDR,
      chainId: "eip155:8453",
      targetRunwayHours: 72,
      minRunwayHours: 24,
      minUsdcBalance: 5,
      createdAt: ISO,
      runwayHours: 10,
      usdcBalance: 5,
      ewmaHourlyBurn: 0.5,
    },
  ];
  state.treasury = [
    {
      id: "usdc-idle",
      walletAddress: VALID_ADDR2,
      chainId: "eip155:8453",
      assetContract: "native",
      symbol: "USDC",
      currentApyEstimate: 0,
      apyLastUpdated: ISO,
      minRetainedBalance: 0,
      priority: 1,
      balance: 1000,
    },
  ];
  state.actions = [
    {
      actionId: VALID_UUID,
      targetWalletId: "demo-1",
      topUpAmountUsdc: 10,
      sourceId: "usdc-idle",
      state: "confirmed",
      txHashes: { send: VALID_TX },
      policyChecks: [],
      createdAt: ISO,
      confirmedAt: ISO,
    },
  ];
  state.kpis = { totalFleetBalance: 5, totalTreasuryBalance: 1000, actions24h: 1 };
  state.samplesById.set("demo-1", [
    {
      walletId: "demo-1",
      usdcBalance: 5,
      sampledAt: ISO,
      last24hSpend: 6,
      last7dSpend: 42,
      ewmaHourlyBurn: 0.5,
      runwayHours: 10,
    },
  ]);
  return state;
}

describe("http-server", () => {
  it("/api/health returns the locked HealthInfo shape", async () => {
    const app = buildApp(makeState());
    const res = await app.fetch(new Request("http://test/api/health"));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.daemonPid, 12345);
    assert.equal(body.version, "0.0.0-test");
  });

  it("/api/state returns the merged StateResponse shape", async () => {
    const app = buildApp(makeState());
    const res = await app.fetch(new Request("http://test/api/state"));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok("fleet" in body);
    assert.ok("treasury" in body);
    assert.ok("kpis" in body);
    assert.equal(body.fleet[0].id, "demo-1");
    assert.equal(body.treasury[0].balance, 1000);
  });

  it("/api/fleet returns the array directly", async () => {
    const app = buildApp(makeState());
    const res = await app.fetch(new Request("http://test/api/fleet"));
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.equal(body.length, 1);
  });

  it("/api/fleet/:id returns wallet + samples", async () => {
    const app = buildApp(makeState());
    const res = await app.fetch(new Request("http://test/api/fleet/demo-1"));
    const body = await res.json();
    assert.equal(body.wallet.id, "demo-1");
    assert.equal(body.samples.length, 1);
  });

  it("/api/fleet/:id 404s on unknown wallet", async () => {
    const app = buildApp(makeState());
    const res = await app.fetch(new Request("http://test/api/fleet/missing"));
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, "not_found");
  });

  it("/api/treasury returns the array", async () => {
    const app = buildApp(makeState());
    const res = await app.fetch(new Request("http://test/api/treasury"));
    const body = await res.json();
    assert.equal(body.length, 1);
    assert.equal(body[0].balance, 1000);
  });

  it("/api/actions paginates and returns nextCursor", async () => {
    const state = makeState();
    state.actions = Array.from({ length: 75 }, (_, i) => ({
      actionId: `01926a3a-1234-7abc-8def-${String(i).padStart(12, "0")}`,
      targetWalletId: "demo-1",
      topUpAmountUsdc: 1,
      sourceId: "usdc-idle",
      state: "confirmed",
      txHashes: {},
      policyChecks: [],
      createdAt: new Date(Date.parse(ISO) - i * 1000).toISOString(),
    }));
    const app = buildApp(state);
    const res = await app.fetch(new Request("http://test/api/actions?limit=50"));
    const body = await res.json();
    assert.equal(body.actions.length, 50);
    assert.ok(body.nextCursor);
  });

  it("/api/actions/:id returns the full action", async () => {
    const app = buildApp(makeState());
    const res = await app.fetch(new Request(`http://test/api/actions/${VALID_UUID}`));
    const body = await res.json();
    assert.equal(body.actionId, VALID_UUID);
    assert.equal(body.txHashes.send, VALID_TX);
  });

  it("/api/policies returns the registry array", async () => {
    const app = buildApp(makeState());
    const res = await app.fetch(new Request("http://test/api/policies"));
    const body = await res.json();
    assert.equal(body.length, 1);
    assert.equal(body[0].name, "allowlist");
  });

  it("/api/policies/:name returns config + evaluations", async () => {
    const state = makeState();
    state.policyEvaluationsByName.set("allowlist", []);
    const app = buildApp(state);
    const res = await app.fetch(new Request("http://test/api/policies/allowlist"));
    const body = await res.json();
    assert.equal(body.entry.name, "allowlist");
    assert.deepEqual(body.evaluations, []);
  });

  it("/api/settings returns the settings response shape", async () => {
    const app = buildApp(makeState());
    const res = await app.fetch(new Request("http://test/api/settings"));
    const body = await res.json();
    assert.equal(body.daemon.port, 7402);
    assert.equal(body.policyDefaults.maxPerActionUsdc, 100);
  });

  it("404 on unknown route", async () => {
    const app = buildApp(makeState());
    const res = await app.fetch(new Request("http://test/api/nonsense"));
    assert.equal(res.status, 404);
  });

  it("CORS preflight returns 204 with allow-origin header", async () => {
    const app = buildApp(makeState());
    const res = await app.fetch(
      new Request("http://test/api/state", {
        method: "OPTIONS",
        headers: { Origin: "http://127.0.0.1:3001", "Access-Control-Request-Method": "GET" },
      }),
    );
    // Hono's cors middleware emits 204 for preflight
    assert.ok([200, 204].includes(res.status));
    assert.equal(res.headers.get("access-control-allow-origin"), "http://127.0.0.1:3001");
  });
});

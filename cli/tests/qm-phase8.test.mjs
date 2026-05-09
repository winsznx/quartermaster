/**
 * Phase 8 — Railway public-deploy regressions.
 *
 * Covers:
 *  - resolveBindConfig: QM_PUBLIC=1 → 0.0.0.0; default → 127.0.0.1; PORT
 *    override; QM_CORS_ORIGINS parsing.
 *  - parseCorsOrigins: comma-split, dedupe, locals always included.
 *  - resolveQmHome: env_qm_home > railway_volume > local_default priority.
 *  - /api/health: includes uptimeSec, fleetSize, lastTickAt, publicMode,
 *    optional liveOrchestrator block.
 *  - http_request access logging: emits one event per request, skippable
 *    via `skipAccessLog`.
 *  - evaluateLiveOrchestrator: each skip path + the trigger path.
 *
 * NOT an upstream test.
 */

import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, before, after, beforeEach, afterEach } from "node:test";

import {
  buildApp,
  emptyState,
  parseCorsOrigins,
  resolveBindConfig,
} from "../lib/qm/http-server.js";
import {
  isRailwayRuntime,
  resolveQmHome,
} from "../lib/qm/storage.js";
import {
  evaluateLiveOrchestrator,
  liveOrchestratorMonthlySpend,
  LIVE_ORCHESTRATOR_DEFAULTS,
} from "../lib/qm/daemon.js";

// ---------- helpers ----------

function newState(overrides = {}) {
  const startedAt = new Date(Date.now() - 5_000).toISOString();
  const base = emptyState({
    daemonPid: process.pid,
    startedAt,
    version: "test-0.0.0",
    settings: {
      daemon: { version: "test-0.0.0", pid: process.pid, port: 7402, logLevel: "info" },
      policyDefaults: { maxPerActionUsdc: 100, minCooldownMinutes: 30, burnRateMultiplierThreshold: 10 },
      fleetThresholds: { targetRunwayHours: 72, minRunwayHours: 24, minUsdcBalance: 5 },
    },
    policies: [],
    publicMode: overrides.publicMode ?? false,
    liveOrchestrator: overrides.liveOrchestrator ?? null,
  });
  return Object.assign(base, overrides);
}

function isolateLedger() {
  const dir = mkdtempSync(join(tmpdir(), "qm-phase8-"));
  process.env.QM_HOME = dir;
  return dir;
}

// ---------- resolveBindConfig ----------

describe("Phase 8: resolveBindConfig", () => {
  it("defaults to 127.0.0.1:7402 when QM_PUBLIC unset", () => {
    const cfg = resolveBindConfig({});
    assert.equal(cfg.publicMode, false);
    assert.equal(cfg.hostname, "127.0.0.1");
    assert.equal(cfg.port, 7402);
  });

  it("binds 0.0.0.0 under QM_PUBLIC=1", () => {
    const cfg = resolveBindConfig({ QM_PUBLIC: "1" });
    assert.equal(cfg.publicMode, true);
    assert.equal(cfg.hostname, "0.0.0.0");
  });

  it("honors PORT (Railway-injected) over QM_PORT and default", () => {
    const cfg = resolveBindConfig({ PORT: "8080", QM_PORT: "9090" });
    assert.equal(cfg.port, 8080);
  });

  it("honors QM_PORT when PORT absent", () => {
    const cfg = resolveBindConfig({ QM_PORT: "9090" });
    assert.equal(cfg.port, 9090);
  });

  it("populates corsOrigins from QM_CORS_ORIGINS", () => {
    const cfg = resolveBindConfig({
      QM_CORS_ORIGINS: "https://landing.vercel.app,https://dashboard.vercel.app",
    });
    assert.ok(cfg.corsOrigins.includes("https://landing.vercel.app"));
    assert.ok(cfg.corsOrigins.includes("https://dashboard.vercel.app"));
    assert.ok(cfg.corsOrigins.includes("http://127.0.0.1:3001"));
  });
});

// ---------- parseCorsOrigins ----------

describe("Phase 8: parseCorsOrigins", () => {
  it("returns local-only when env unset", () => {
    const list = parseCorsOrigins(undefined);
    assert.deepEqual(list.sort(), [
      "http://127.0.0.1:3001",
      "http://localhost:3001",
    ]);
  });

  it("comma-splits and trims", () => {
    const list = parseCorsOrigins(" https://a.example , https://b.example ");
    assert.ok(list.includes("https://a.example"));
    assert.ok(list.includes("https://b.example"));
  });

  it("dedupes against locals and within itself", () => {
    const list = parseCorsOrigins("http://localhost:3001,https://x.example,https://x.example");
    const xCount = list.filter((o) => o === "https://x.example").length;
    assert.equal(xCount, 1);
    const localCount = list.filter((o) => o === "http://localhost:3001").length;
    assert.equal(localCount, 1);
  });

  it("always lists local origins first", () => {
    const list = parseCorsOrigins("https://a.example");
    assert.equal(list[0], "http://127.0.0.1:3001");
    assert.equal(list[1], "http://localhost:3001");
  });
});

// ---------- resolveQmHome ----------

describe("Phase 8: resolveQmHome", () => {
  it("returns env_qm_home when QM_HOME set", () => {
    const out = resolveQmHome({ QM_HOME: "/custom/qm" });
    assert.equal(out.root, "/custom/qm");
    assert.equal(out.source, "env_qm_home");
  });

  it("returns railway_volume when RAILWAY_* present and QM_HOME unset", () => {
    const out = resolveQmHome({ RAILWAY_ENVIRONMENT: "production" });
    assert.equal(out.root, "/data/quartermaster");
    assert.equal(out.source, "railway_volume");
  });

  it("returns local_default otherwise", () => {
    const out = resolveQmHome({});
    assert.equal(out.source, "local_default");
    assert.ok(out.root.endsWith("/.zerion/quartermaster"));
  });

  it("env_qm_home wins over railway_volume", () => {
    const out = resolveQmHome({ QM_HOME: "/x", RAILWAY_PROJECT_ID: "abc" });
    assert.equal(out.source, "env_qm_home");
    assert.equal(out.root, "/x");
  });

  it("isRailwayRuntime detects any RAILWAY_ prefix", () => {
    assert.equal(isRailwayRuntime({}), false);
    assert.equal(isRailwayRuntime({ RAILWAY_SERVICE_ID: "x" }), true);
    assert.equal(isRailwayRuntime({ RAILWAY_DEPLOYMENT_ID: "x" }), true);
  });
});

// ---------- /api/health ----------

describe("Phase 8: /api/health expanded shape", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = isolateLedger();
  });

  afterEach(() => {
    delete process.env.QM_HOME;
    rmSync(sandbox, { recursive: true, force: true });
  });

  it("includes uptimeSec, fleetSize, publicMode, lastTickAt", async () => {
    const state = newState({
      publicMode: true,
      lastTickAt: "2026-05-08T12:00:00.000Z",
    });
    state.fleet = [
      { id: "alpha-1", address: "0x" + "a".repeat(40), chainId: "eip155:8453", targetRunwayHours: 72, minRunwayHours: 24, minUsdcBalance: 5, createdAt: "2026-05-01T00:00:00.000Z", runwayHours: 100, usdcBalance: 1, ewmaHourlyBurn: 0.01 },
      { id: "alpha-2", address: "0x" + "b".repeat(40), chainId: "eip155:8453", targetRunwayHours: 72, minRunwayHours: 24, minUsdcBalance: 5, createdAt: "2026-05-01T00:00:00.000Z", runwayHours: 200, usdcBalance: 2, ewmaHourlyBurn: 0.01 },
    ];
    const app = buildApp(state, { skipAccessLog: true });
    const res = await app.fetch(new Request("http://test/api/health"));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.fleetSize, 2);
    assert.equal(body.publicMode, true);
    assert.equal(body.lastTickAt, "2026-05-08T12:00:00.000Z");
    assert.ok(typeof body.uptimeSec === "number" && body.uptimeSec >= 0);
  });

  it("surfaces liveOrchestrator block when present", async () => {
    const state = newState({
      publicMode: true,
      liveOrchestrator: {
        enabled: true,
        monthlyBudgetUsdc: 5,
        monthlySpentUsdc: 0.04,
        budgetExhausted: false,
        lastDecision: { decision: "skipped_no_burn_window", reason: "recent burn", ts: "2026-05-08T12:00:00.000Z" },
      },
    });
    const app = buildApp(state, { skipAccessLog: true });
    const res = await app.fetch(new Request("http://test/api/health"));
    const body = await res.json();
    assert.equal(body.liveOrchestrator.enabled, true);
    assert.equal(body.liveOrchestrator.monthlySpentUsdc, 0.04);
    assert.equal(body.liveOrchestrator.lastDecision.decision, "skipped_no_burn_window");
  });
});

// ---------- access logging ----------

describe("Phase 8: http_request access log", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = isolateLedger();
  });

  afterEach(() => {
    delete process.env.QM_HOME;
    rmSync(sandbox, { recursive: true, force: true });
  });

  it("emits an http_request ledger event per request when accessLog enabled", async () => {
    const state = newState();
    const app = buildApp(state, { accessLog: true });
    const res = await app.fetch(new Request("http://test/api/health", { headers: { origin: "https://judge.example" } }));
    assert.equal(res.status, 200);
    const ledger = readFileSync(join(sandbox, "ledger.jsonl"), "utf-8");
    const events = ledger.trim().split("\n").map((l) => JSON.parse(l));
    const httpEvent = events.find((e) => e.type === "http_request");
    assert.ok(httpEvent, "http_request event missing");
    assert.equal(httpEvent.method, "GET");
    assert.equal(httpEvent.path, "/api/health");
    assert.equal(httpEvent.status, 200);
    assert.equal(httpEvent.origin, "https://judge.example");
    assert.ok(typeof httpEvent.durationMs === "number" && httpEvent.durationMs >= 0);
  });

  it("skips logging when skipAccessLog is true", async () => {
    const state = newState();
    const app = buildApp(state, { skipAccessLog: true });
    await app.fetch(new Request("http://test/api/health"));
    let raw = "";
    try {
      raw = readFileSync(join(sandbox, "ledger.jsonl"), "utf-8");
    } catch {
      // file may not exist — that's fine
    }
    const httpCount = raw.split("\n").filter((l) => l.includes('"http_request"')).length;
    assert.equal(httpCount, 0);
  });
});

// ---------- live orchestrator ----------

describe("Phase 8: evaluateLiveOrchestrator", () => {
  const baseInput = {
    publicMode: true,
    passphraseSet: true,
    fleet: [
      { id: "alpha-1", usdcBalance: 0.5, ewmaHourlyBurn: 0 },
      { id: "alpha-2", usdcBalance: 0.4, ewmaHourlyBurn: 0 },
    ],
    observations: [
      { wallet: { id: "alpha-1" }, sample: { ewmaHourlyBurn: 0 } },
      { wallet: { id: "alpha-2" }, sample: { ewmaHourlyBurn: 0 } },
    ],
    monthlySpentUsdc: 0,
    config: {},
    now: new Date("2026-05-08T12:00:00.000Z"),
  };

  it("returns skipped_no_burn_window when publicMode false", () => {
    const out = evaluateLiveOrchestrator({ ...baseInput, publicMode: false });
    assert.equal(out.decision, "skipped_no_burn_window");
    assert.match(out.reason, /publicMode disabled/);
  });

  it("returns skipped_passphrase_missing when passphrase absent", () => {
    const out = evaluateLiveOrchestrator({ ...baseInput, passphraseSet: false });
    assert.equal(out.decision, "skipped_passphrase_missing");
  });

  it("returns skipped_low_subordinate_balance when any subordinate below floor", () => {
    const out = evaluateLiveOrchestrator({
      ...baseInput,
      fleet: [
        { id: "alpha-1", usdcBalance: 0.5, ewmaHourlyBurn: 0 },
        { id: "alpha-2", usdcBalance: 0.05, ewmaHourlyBurn: 0 },
      ],
    });
    assert.equal(out.decision, "skipped_low_subordinate_balance");
    assert.equal(out.walletId, "alpha-2");
  });

  it("returns skipped_no_burn_window when recent burn observed (ewma > epsilon)", () => {
    const out = evaluateLiveOrchestrator({
      ...baseInput,
      observations: [
        { wallet: { id: "alpha-1" }, sample: { ewmaHourlyBurn: 0.05 } },
        { wallet: { id: "alpha-2" }, sample: { ewmaHourlyBurn: 0 } },
      ],
    });
    assert.equal(out.decision, "skipped_no_burn_window");
    assert.match(out.reason, /recent burn detected/);
  });

  it("returns skipped_budget_exhausted when monthly cap would be exceeded", () => {
    const out = evaluateLiveOrchestrator({
      ...baseInput,
      monthlySpentUsdc: LIVE_ORCHESTRATOR_DEFAULTS.budgetUsdc, // exactly at cap
    });
    assert.equal(out.decision, "skipped_budget_exhausted");
  });

  it("returns triggered_burn picking the highest-balance subordinate", () => {
    const out = evaluateLiveOrchestrator({
      ...baseInput,
      fleet: [
        { id: "alpha-1", usdcBalance: 0.3, ewmaHourlyBurn: 0 },
        { id: "alpha-2", usdcBalance: 0.5, ewmaHourlyBurn: 0 },
        { id: "alpha-3", usdcBalance: 0.2, ewmaHourlyBurn: 0 },
      ],
    });
    assert.equal(out.decision, "triggered_burn");
    assert.equal(out.walletId, "alpha-2");
  });

  it("decision order: publicMode check fires before passphrase check", () => {
    const out = evaluateLiveOrchestrator({
      ...baseInput,
      publicMode: false,
      passphraseSet: false,
    });
    assert.equal(out.decision, "skipped_no_burn_window");
  });
});

// ---------- monthly spend tally ----------

describe("Phase 8: liveOrchestratorMonthlySpend", () => {
  let sandbox;

  before(() => {
    sandbox = isolateLedger();
  });

  after(() => {
    delete process.env.QM_HOME;
    rmSync(sandbox, { recursive: true, force: true });
  });

  it("sums triggered_burn events from current month and ignores prior months + non-trigger decisions", async () => {
    // Seed the ledger with mixed events across months.
    const { appendEvent } = await import("../lib/qm/ledger.js");
    const now = new Date("2026-05-08T12:00:00.000Z");
    appendEvent({ type: "live_orchestrator_tick", ts: "2026-04-15T00:00:00.000Z", decision: "triggered_burn", reason: "prior month" });
    appendEvent({ type: "live_orchestrator_tick", ts: "2026-05-01T01:00:00.000Z", decision: "triggered_burn", reason: "this month" });
    appendEvent({ type: "live_orchestrator_tick", ts: "2026-05-02T01:00:00.000Z", decision: "skipped_no_burn_window", reason: "skipped — should not count" });
    appendEvent({ type: "live_orchestrator_tick", ts: "2026-05-08T01:00:00.000Z", decision: "triggered_burn", reason: "this month" });

    const { triggers, spentUsdc } = await liveOrchestratorMonthlySpend(now, 0.02);
    assert.equal(triggers, 2);
    assert.ok(Math.abs(spentUsdc - 0.04) < 1e-9);
  });
});

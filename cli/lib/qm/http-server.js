/**
 * Daemon HTTP API — PRD §22.3 + Phase 8 public-deploy binding.
 *
 * Hono app, response shapes parsed against `@quartermaster/shared-schemas`
 * before send. Exported as a factory so tests can supply a `state` object
 * (the daemon's in-memory snapshot) and use `app.fetch(Request)` directly
 * without binding a port.
 *
 * Default: bind 127.0.0.1 (loopback). Under QM_PUBLIC=1: bind 0.0.0.0 so
 * Railway's edge proxy can reach the container, and widen CORS to the
 * configured Vercel origins. Routes stay GET-only — judges can browse,
 * no mutations exposed via HTTP.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";

import {
  ActionDetailResponse,
  ActionsResponse,
  FleetResponse,
  FleetWalletDetailResponse,
  HealthInfo,
  PoliciesResponse,
  PolicyDetailResponse,
  SettingsResponse,
  StateResponse,
  TreasuryResponse,
} from "@quartermaster/shared-schemas";

import { appendEvent } from "./ledger.js";

/**
 * Parse `QM_CORS_ORIGINS` (comma-separated list) into an allowlist array.
 * Always includes the local-dev origins so self-host workflows keep working.
 */
export function parseCorsOrigins(envVal) {
  const local = ["http://127.0.0.1:3001", "http://localhost:3001"];
  if (!envVal || typeof envVal !== "string") return local;
  const extras = envVal
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Dedupe while preserving order; locals first.
  const seen = new Set();
  const out = [];
  for (const o of [...local, ...extras]) {
    if (seen.has(o)) continue;
    seen.add(o);
    out.push(o);
  }
  return out;
}

/**
 * Resolve the bind hostname + public-mode flag from env. QM_PUBLIC=1 binds
 * to all interfaces so Railway's proxy can reach the container.
 */
export function resolveBindConfig(env = process.env) {
  const publicMode = env.QM_PUBLIC === "1";
  const hostname = publicMode ? "0.0.0.0" : "127.0.0.1";
  const port = Number(env.PORT ?? env.QM_PORT ?? 7402);
  const corsOrigins = parseCorsOrigins(env.QM_CORS_ORIGINS);
  return { publicMode, hostname, port, corsOrigins };
}

/**
 * Build a Hono app bound to a daemon `state` object. The state object is
 * mutable; the daemon updates it each tick. The HTTP layer reads it but
 * never writes (HTTP is GET-only per PRD §22.3).
 *
 * `state` shape:
 *   {
 *     health: HealthInfo,
 *     fleet: WalletWithDerived[],
 *     treasury: TreasurySourceWithBalance[],
 *     actions: TopUpAction[],
 *     kpis: Kpis,
 *     policyStats: PolicyStats,
 *     samplesById: Map<walletId, BurnRateSample[]>,
 *     policies: PolicyRegistryEntry[],
 *     policyEvaluationsByName: Map<policyName, PolicyEvaluation[]>,
 *     settings: SettingsResponse,
 *     subscribers: Set<{ stream }>,  // SSE
 *   }
 */
export function buildApp(state, options = {}) {
  const app = new Hono();
  const allowedOrigins = options.corsOrigins ?? [
    "http://127.0.0.1:3001",
    "http://localhost:3001",
  ];
  // Optional: skipAccessLog (used by tests so the regression suite isn't
  // chatty against the ledger).
  const accessLog = options.accessLog ?? !options.skipAccessLog;

  app.use("*", cors({ origin: allowedOrigins }));

  if (accessLog) {
    app.use("*", async (c, next) => {
      const t0 = Date.now();
      await next();
      try {
        appendEvent({
          type: "http_request",
          ts: new Date().toISOString(),
          method: c.req.method,
          path: c.req.path,
          status: c.res.status,
          durationMs: Date.now() - t0,
          origin: c.req.header("origin") ?? null,
        });
      } catch {
        // Ledger write failure should never break a response. Drop the log
        // line silently — the daemon keeps serving. Phase-7a precedent:
        // tx hashes are the source of truth, ledger is the log.
      }
    });
  }

  app.get("/api/health", (c) => {
    const now = Date.now();
    const startedAtMs = state.health?.startedAt ? new Date(state.health.startedAt).getTime() : now;
    const lastTickAt = state.lastTickAt ?? null;
    const fleetSize = Array.isArray(state.fleet) ? state.fleet.length : 0;
    const liveOrchestrator = state.liveOrchestrator ?? undefined;
    const payload = {
      ...state.health,
      uptimeSec: Math.max(0, Math.floor((now - startedAtMs) / 1000)),
      fleetSize,
      lastTickAt,
      publicMode: state.publicMode ?? false,
      ...(liveOrchestrator ? { liveOrchestrator } : {}),
    };
    return c.json(HealthInfo.parse(payload));
  });

  app.get("/api/state", (c) => {
    const payload = {
      ...state.health,
      fleet: state.fleet,
      treasury: state.treasury,
      actions: state.actions,
      kpis: state.kpis,
      policyStats: state.policyStats,
    };
    return c.json(StateResponse.parse(payload));
  });

  app.get("/api/state/stream", (c) => {
    return streamSSE(c, async (stream) => {
      // Send the current state as the first frame so subscribers don't have
      // to also call /api/state.
      const initial = {
        ...state.health,
        fleet: state.fleet,
        treasury: state.treasury,
        actions: state.actions,
        kpis: state.kpis,
        policyStats: state.policyStats,
      };
      await stream.writeSSE({
        event: "state",
        data: JSON.stringify(StateResponse.parse(initial)),
      });

      // Register the stream so the daemon can broadcast on tick.
      const subscriber = { stream };
      state.subscribers.add(subscriber);

      // Keep the stream alive until the client disconnects.
      try {
        await stream.sleep(60 * 60 * 1000); // 1h max session
      } finally {
        state.subscribers.delete(subscriber);
      }
    });
  });

  app.get("/api/fleet", (c) => c.json(FleetResponse.parse(state.fleet)));

  app.get("/api/fleet/:id", (c) => {
    const id = c.req.param("id");
    const wallet = state.fleet.find((w) => w.id === id);
    if (!wallet) return c.json({ error: { code: "not_found", message: `wallet "${id}" not in fleet` } }, 404);
    const samples = state.samplesById.get(id) ?? [];
    return c.json(FleetWalletDetailResponse.parse({ wallet, samples }));
  });

  app.get("/api/treasury", (c) => c.json(TreasuryResponse.parse(state.treasury)));

  app.get("/api/actions", (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
    const before = c.req.query("before");
    let actions = state.actions;
    if (before) {
      actions = actions.filter((a) => a.createdAt < before);
    }
    const sliced = actions.slice(0, limit);
    const nextCursor =
      sliced.length === limit && actions.length > limit
        ? sliced[sliced.length - 1].createdAt
        : null;
    return c.json(ActionsResponse.parse({ actions: sliced, nextCursor }));
  });

  app.get("/api/actions/:id", (c) => {
    const id = c.req.param("id");
    const action = state.actions.find((a) => a.actionId === id);
    if (!action) return c.json({ error: { code: "not_found", message: `action "${id}" not found` } }, 404);
    return c.json(ActionDetailResponse.parse(action));
  });

  app.get("/api/policies", (c) => c.json(PoliciesResponse.parse(state.policies)));

  app.get("/api/policies/:name", (c) => {
    const name = c.req.param("name");
    const entry = state.policies.find((p) => p.name === name);
    if (!entry) return c.json({ error: { code: "not_found", message: `policy "${name}" not registered` } }, 404);
    const evaluations = state.policyEvaluationsByName.get(name) ?? [];
    return c.json(
      PolicyDetailResponse.parse({
        entry,
        config: state.policyConfig?.[name] ?? {},
        evaluations,
      }),
    );
  });

  app.get("/api/settings", (c) => c.json(SettingsResponse.parse(state.settings)));

  app.notFound((c) =>
    c.json({ error: { code: "not_found", message: `route ${c.req.path} does not exist` } }, 404),
  );

  return app;
}

/**
 * Broadcast a state-snapshot frame to every SSE subscriber. Called by the
 * daemon at the end of each tick so dashboards see live updates.
 */
export async function broadcastState(state) {
  const payload = {
    ...state.health,
    fleet: state.fleet,
    treasury: state.treasury,
    actions: state.actions,
    kpis: state.kpis,
    policyStats: state.policyStats,
  };
  const validated = StateResponse.parse(payload);
  const data = JSON.stringify(validated);
  for (const sub of state.subscribers) {
    try {
      await sub.stream.writeSSE({ event: "state", data });
    } catch {
      // Subscriber disconnected mid-write; cleanup happens in the SSE handler.
    }
  }
}

/**
 * Build a fresh, empty daemon state object. The daemon hydrates it at
 * startup from `~/.zerion/quartermaster/`.
 */
export function emptyState({ daemonPid, startedAt, version, settings, policies, publicMode = false, liveOrchestrator = null }) {
  return {
    health: { status: "ok", daemonPid, startedAt, version },
    fleet: [],
    treasury: [],
    actions: [],
    kpis: { totalFleetBalance: 0, totalTreasuryBalance: 0, actions24h: 0 },
    policyStats: {},
    samplesById: new Map(),
    policies,
    policyEvaluationsByName: new Map(),
    policyConfig: {},
    settings,
    subscribers: new Set(),
    // Phase 8 additions for /api/health expansion + live orchestrator status.
    publicMode,
    lastTickAt: null,
    liveOrchestrator,
  };
}

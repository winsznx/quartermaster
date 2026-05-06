/**
 * Daemon HTTP API — PRD §22.3.
 *
 * Hono app, response shapes parsed against `@quartermaster/shared-schemas`
 * before send. Exported as a factory so tests can supply a `state` object
 * (the daemon's in-memory snapshot) and use `app.fetch(Request)` directly
 * without binding a port.
 *
 * Bind to 127.0.0.1 ONLY (PRD §10.1). CORS is wide-open for the local
 * dashboard at :3001. Phase 6 will widen to the Vercel origin once
 * NEXT_PUBLIC_DAEMON_URL points at Railway.
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

  app.use("*", cors({ origin: allowedOrigins }));

  app.get("/api/health", (c) => {
    return c.json(HealthInfo.parse(state.health));
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
export function emptyState({ daemonPid, startedAt, version, settings, policies }) {
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
  };
}

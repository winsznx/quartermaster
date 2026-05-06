"use client";

/**
 * Daemon HTTP client — single source of truth for all /api/* calls.
 *
 * Uses `DAEMON_URL` (Phase 1 env-var refactor: defaults to 127.0.0.1:7402,
 * overridable via NEXT_PUBLIC_DAEMON_URL).
 *
 * Every fetch:
 * - Times out at 5s (overridable per-call) — long enough for SSE init,
 *   short enough that an offline daemon surfaces fast.
 * - Returns `DaemonResult<T>` — discriminated union over `status` so callers
 *   handle offline / error / data uniformly without try/catch noise.
 * - Does NOT throw — UI code reads `result.status === 'ok' ? result.data : ...`.
 *
 * Schema parsing happens at the boundary: every successful response is
 * validated against the matching `@quartermaster/shared-schemas` shape
 * before reaching the UI. A malformed response from the daemon (which would
 * indicate a daemon bug) becomes a `daemon_drift` error so the UI can
 * surface it distinctly from "daemon offline."
 */

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

// Minimal subset of the zod schema interface we actually use here. Avoids
// pulling zod's full type into dashboard tsconfig, which has resolution
// quirks across workspace packages with strict mode.
interface ParseableSchema<T> {
  safeParse: (value: unknown) =>
    | { success: true; data: T }
    | { success: false; error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> } };
}

import { DAEMON_URL } from "./daemon-url";

export type DaemonResult<T> =
  | { status: "ok"; data: T }
  | { status: "offline"; error: string }
  | { status: "error"; error: string; httpStatus?: number }
  | { status: "drift"; error: string; raw: unknown };

interface FetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function daemonFetch<T>(
  path: string,
  schema: ParseableSchema<T>,
  options: FetchOptions = {},
): Promise<DaemonResult<T>> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 5_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  let res: Response;
  try {
    res = await fetch(`${DAEMON_URL}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "offline", error: `daemon unreachable: ${msg}` };
  }
  clearTimeout(timer);

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // body unparseable — fine
    }
    const message =
      body && typeof body === "object" && "error" in body
        ? // @ts-expect-error — narrow at runtime
          body.error?.message ?? `HTTP ${res.status}`
        : `HTTP ${res.status}`;
    return { status: "error", error: message, httpStatus: res.status };
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch (err) {
    return {
      status: "drift",
      error: `daemon returned non-JSON for ${path}`,
      raw: err,
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "drift",
      error: `daemon response shape mismatch on ${path}: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      raw,
    };
  }
  return { status: "ok", data: parsed.data };
}

export const daemonClient = {
  health: (opts?: FetchOptions) => daemonFetch("/api/health", HealthInfo, opts),
  state: (opts?: FetchOptions) => daemonFetch("/api/state", StateResponse, opts),
  fleet: (opts?: FetchOptions) => daemonFetch("/api/fleet", FleetResponse, opts),
  fleetWallet: (id: string, opts?: FetchOptions) =>
    daemonFetch(`/api/fleet/${encodeURIComponent(id)}`, FleetWalletDetailResponse, opts),
  treasury: (opts?: FetchOptions) =>
    daemonFetch("/api/treasury", TreasuryResponse, opts),
  actions: (limit?: number, before?: string, opts?: FetchOptions) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (before) params.set("before", before);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return daemonFetch(`/api/actions${qs}`, ActionsResponse, opts);
  },
  action: (id: string, opts?: FetchOptions) =>
    daemonFetch(`/api/actions/${encodeURIComponent(id)}`, ActionDetailResponse, opts),
  policies: (opts?: FetchOptions) =>
    daemonFetch("/api/policies", PoliciesResponse, opts),
  policy: (name: string, opts?: FetchOptions) =>
    daemonFetch(`/api/policies/${encodeURIComponent(name)}`, PolicyDetailResponse, opts),
  settings: (opts?: FetchOptions) =>
    daemonFetch("/api/settings", SettingsResponse, opts),
};

/**
 * EventSource wrapper for `/api/state/stream`. Falls back to polling at
 * `pollMs` if EventSource is unavailable or the stream errors twice in a
 * row. Returns an `unsubscribe` function.
 */
export function subscribeState(
  onState: (state: import("@quartermaster/shared-schemas").StateResponse) => void,
  options: { pollMs?: number; onError?: (msg: string) => void } = {},
): () => void {
  const pollMs = options.pollMs ?? 5_000;
  let cancelled = false;
  let es: EventSource | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let consecutiveErrors = 0;

  function fallbackToPoll(reason: string) {
    if (cancelled) return;
    options.onError?.(reason);
    if (es) {
      es.close();
      es = null;
    }
    if (pollTimer) return; // already polling
    const tick = async () => {
      const result = await daemonClient.state();
      if (result.status === "ok" && !cancelled) onState(result.data);
    };
    tick();
    pollTimer = setInterval(tick, pollMs);
  }

  if (typeof EventSource !== "undefined") {
    try {
      es = new EventSource(`${DAEMON_URL}/api/state/stream`);
      es.addEventListener("state", (ev: MessageEvent) => {
        try {
          const parsed = StateResponse.parse(JSON.parse(ev.data));
          consecutiveErrors = 0;
          if (!cancelled) onState(parsed);
        } catch (err) {
          consecutiveErrors += 1;
          if (consecutiveErrors >= 2) {
            fallbackToPoll(`SSE drift: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      });
      es.onerror = () => {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 2) fallbackToPoll("SSE connection failed");
      };
    } catch {
      fallbackToPoll("SSE construction failed");
    }
  } else {
    fallbackToPoll("EventSource unavailable");
  }

  return () => {
    cancelled = true;
    if (es) es.close();
    if (pollTimer) clearInterval(pollTimer);
  };
}

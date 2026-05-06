"use client";

/**
 * Tiny hooks layer over `daemonClient` — handles loading/error/data state
 * uniformly so each page doesn't reimplement the pattern.
 *
 * Convention: hooks return `{ status: "loading" | "ok" | "offline" | "error" | "drift", data?, error? }`.
 * Pages render via a switch on `status`.
 */

import { useEffect, useState } from "react";

import type { DaemonResult } from "./daemon-client";

export type HookState<T> =
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "offline"; error: string }
  | { status: "error"; error: string; httpStatus?: number }
  | { status: "drift"; error: string };

function fromResult<T>(r: DaemonResult<T>): Exclude<HookState<T>, { status: "loading" }> {
  if (r.status === "ok") return r;
  if (r.status === "drift") return { status: "drift", error: r.error };
  return r;
}

/**
 * Poll a daemon endpoint at `intervalMs`. Returns a render-ready state.
 *
 * Pass `key` to force re-fetch on prop changes (e.g., route param changes).
 */
export function usePolledDaemon<T>(
  fetcher: () => Promise<DaemonResult<T>>,
  intervalMs = 5_000,
  key?: string,
): HookState<T> {
  const [state, setState] = useState<HookState<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const result = await fetcher();
      if (!cancelled) setState(fromResult(result));
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // fetcher is intentionally NOT a dep — caller should memoize or use `key`
    // to force re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, key]);

  return state;
}

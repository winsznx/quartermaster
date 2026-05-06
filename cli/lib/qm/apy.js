/**
 * Per-source APY estimator — PRD §9.4 / §22.1.
 *
 * Cached at `~/.zerion/quartermaster/apy-cache.json` with hourly TTL. The
 * decider reads APY estimates when ranking sources for `yield-curve-preservation`
 * (PRD §8.4).
 *
 * Phase 4 implementation: stores `currentApyEstimate` per-source-id with
 * `apyLastUpdated`. The watcher refreshes by calling `refreshApy(sources, fetcher)`
 * once per hour. The fetcher is a function `(source) => Promise<number>`.
 * Production wires `fetchApy` from `apy-fetcher.js` (spawns upstream); tests
 * inject a deterministic fetcher to avoid subprocess overhead.
 *
 * In production the fetcher will spawn `zerion analytics positions <wallet>` and
 * extract the source's APY from `apr` field on the matching position. That
 * subprocess wrapper lives in cli/lib/qm/apy-fetcher.js (Phase 4.1 follow-up if
 * needed); for now Phase 4 plumbs the function signature so the watcher and
 * decider integrate cleanly.
 */

import { z } from "zod";

import {
  qmPath,
  readJsonOrDefault,
  writeJsonAtomic,
} from "./storage.js";

const REFRESH_TTL_MS = 60 * 60 * 1000; // 1 hour per PRD §13

const ApyCacheEntry = z
  .object({
    apy: z.number().min(0),
    updatedAt: z.string(),
  })
  .strict();
const ApyCacheFile = z.record(z.string(), ApyCacheEntry);

function cachePath() {
  return qmPath("apy-cache.json");
}

export function loadCache() {
  return ApyCacheFile.parse(readJsonOrDefault(cachePath(), {}));
}

export function saveCache(cache) {
  writeJsonAtomic(cachePath(), ApyCacheFile.parse(cache));
}

/**
 * Get the cached APY for a source. Returns `null` if missing or stale.
 */
export function getCachedApy(sourceId, now = new Date()) {
  const cache = loadCache();
  const entry = cache[sourceId];
  if (!entry) return null;
  const age = now.getTime() - new Date(entry.updatedAt).getTime();
  if (Number.isNaN(age) || age >= REFRESH_TTL_MS) return null;
  return entry.apy;
}

/**
 * Refresh APY for a list of sources. Calls `fetcher(source)` for each entry
 * whose cached value is missing or stale; preserves fresh entries untouched.
 *
 * Returns the merged cache (also persisted).
 */
export async function refreshApy(sources, fetcher, now = new Date()) {
  const cache = loadCache();
  const nowIso = now.toISOString();
  const errors = [];
  for (const source of sources) {
    const existing = cache[source.id];
    const age =
      existing != null
        ? now.getTime() - new Date(existing.updatedAt).getTime()
        : Number.POSITIVE_INFINITY;
    if (existing && age < REFRESH_TTL_MS) continue;
    try {
      const apy = await fetcher(source);
      if (typeof apy !== "number" || apy < 0 || Number.isNaN(apy)) {
        throw new Error(
          `apy fetcher returned invalid value for "${source.id}": ${apy}`,
        );
      }
      cache[source.id] = { apy, updatedAt: nowIso };
    } catch (err) {
      errors.push({ sourceId: source.id, message: err.message });
      // Keep the stale value rather than dropping the source — better stale
      // than missing for the yield-curve-preservation policy.
    }
  }
  saveCache(cache);
  return { cache, errors };
}

/**
 * Apply cached APY estimates to a list of TreasurySource objects, returning
 * a new array with `currentApyEstimate` and `apyLastUpdated` fields refreshed
 * where the cache is fresh. Sources whose APY is missing keep their existing
 * value (the persisted treasury.json default).
 */
export function applyApyToSources(sources, now = new Date()) {
  const cache = loadCache();
  return sources.map((source) => {
    const entry = cache[source.id];
    if (!entry) return source;
    const age = now.getTime() - new Date(entry.updatedAt).getTime();
    if (Number.isNaN(age) || age >= REFRESH_TTL_MS) return source;
    return {
      ...source,
      currentApyEstimate: entry.apy,
      apyLastUpdated: entry.updatedAt,
    };
  });
}

export const __testing = { REFRESH_TTL_MS };

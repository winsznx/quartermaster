/**
 * Minimal `.env.local` loader for the Quartermaster CLI.
 *
 * Why not `dotenv`: 15 lines do what we need, the file format is dead simple
 * (KEY=VALUE per line, # for comments), and skipping the dep keeps the
 * subprocess startup time low for the executor's per-action `npx zerion`
 * spawns.
 *
 * Walks up from this module's location looking for a `.env.local` at the
 * monorepo root. Returns the parsed key/value object plus the path that
 * was found (null if none).
 *
 * Daemon startup merges these into `process.env` (existing process.env
 * values WIN — operator-set vars are not overridden). Subprocess spawn
 * sites also pass the merged env explicitly so the upstream `npx zerion`
 * invocations see the API key + the QM_ENABLE_BASE_SEPOLIA flag.
 *
 * NOT an upstream file. Phase 4.6-prep deliverable.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_PARENT_HOPS = 8;

/**
 * Parse `.env.local`-format text. Returns a plain object.
 *
 * - Blank lines and `#` comment lines are skipped.
 * - Surrounding single or double quotes on values are stripped.
 * - The first `=` separates key from value; further `=` are part of value.
 * - Lines without `=` are ignored.
 */
export function parseEnv(raw) {
  const out = {};
  for (const line of String(raw).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Walk up from `startDir` looking for `<dir>/.env.local`. Returns the path
 * or null if not found within MAX_PARENT_HOPS.
 */
export function findEnvLocal(startDir) {
  let dir = startDir;
  for (let i = 0; i < MAX_PARENT_HOPS; i++) {
    const candidate = join(dir, ".env.local");
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      // not here, keep walking
    }
    const parent = dirname(dir);
    if (parent === dir) break; // hit filesystem root
    dir = parent;
  }
  return null;
}

/**
 * Load `.env.local` (if present) and return `{ values, path }`.
 *
 * `options.path` overrides search — handy for tests.
 * `options.startDir` overrides search start — handy for tests.
 */
export function loadEnvLocal(options = {}) {
  let path = options.path ?? null;
  if (!path) {
    const startDir = options.startDir ?? dirname(fileURLToPath(import.meta.url));
    path = findEnvLocal(startDir);
  }
  if (!path) return { values: {}, path: null };
  let raw;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    return { values: {}, path: null };
  }
  return { values: parseEnv(raw), path };
}

/**
 * Load `.env.local` and the QM patch flag. Returns the env object the QM
 * daemon merges into `process.env` and the executor / portfolio-fetcher
 * pass through to spawned subprocesses.
 *
 * The `QM_ENABLE_BASE_SEPOLIA=1` flag opts the spawned upstream CLI into
 * the registry patch so `--chain base-sepolia` resolves. See
 * `cli/cli/lib/chain/registry.js` Quartermaster patch block.
 */
export function buildSubprocessEnv(parentEnv = process.env) {
  const { values } = loadEnvLocal();
  return {
    ...values,
    ...parentEnv, // operator-set values WIN over .env.local
    QM_ENABLE_BASE_SEPOLIA: "1",
  };
}

/**
 * Merge `.env.local` into `process.env` for the current process. Existing
 * process.env keys are preserved (operator overrides win). Returns the
 * keys that were added or updated for telemetry.
 */
export function mergeIntoProcessEnv() {
  const { values, path } = loadEnvLocal();
  const added = [];
  for (const [k, v] of Object.entries(values)) {
    if (process.env[k] != null && process.env[k] !== "") continue;
    process.env[k] = v;
    added.push(k);
  }
  return { path, added };
}

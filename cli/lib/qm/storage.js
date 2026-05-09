/**
 * Storage helpers for the Quartermaster state directory — PRD §13.
 *
 * Directory resolution priority (Phase 8):
 *   1. process.env.QM_HOME (explicit override; tests, custom self-hosters)
 *   2. /data/quartermaster (Railway volume convention — when any RAILWAY_*
 *      env var is present, indicating we're inside a Railway container)
 *   3. ~/.zerion/quartermaster (default — local self-hosters and dev)
 *
 * NOT an upstream file. Lives at cli/lib/qm/ (Quartermaster scope) to keep
 * upstream cli/cli/ untouched.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const LOCAL_QM_DIR = join(homedir(), ".zerion", "quartermaster");
const RAILWAY_QM_DIR = "/data/quartermaster";

/**
 * Returns true iff any Railway-injected env var is set. Railway sets a
 * cluster of `RAILWAY_*` vars on every deploy (RAILWAY_ENVIRONMENT,
 * RAILWAY_PROJECT_ID, RAILWAY_SERVICE_ID, etc.). Detecting any one is
 * sufficient — we don't depend on a specific name in case Railway renames.
 */
export function isRailwayRuntime(env = process.env) {
  for (const key of Object.keys(env)) {
    if (key.startsWith("RAILWAY_")) return true;
  }
  return false;
}

/**
 * Resolve the QM state directory root. Public so the daemon can log it
 * at startup and tests can verify the resolution rules without monkey-
 * patching internals.
 */
export function resolveQmHome(env = process.env) {
  if (env.QM_HOME) return { root: env.QM_HOME, source: "env_qm_home" };
  if (isRailwayRuntime(env)) return { root: RAILWAY_QM_DIR, source: "railway_volume" };
  return { root: LOCAL_QM_DIR, source: "local_default" };
}

/**
 * Resolve a Quartermaster file path under the chosen state directory.
 */
export function qmPath(...segments) {
  const { root } = resolveQmHome();
  return join(root, ...segments);
}

/**
 * Read JSON file, returning fallback (default: null) when missing.
 * Rethrows on parse error or any other failure.
 */
export function readJsonOrDefault(path, fallback = null) {
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err && err.code === "ENOENT") return fallback;
    throw err;
  }
}

/**
 * Atomic JSON write — temp + rename per PRD §13.2.
 * Creates parent directories if missing.
 */
export function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf-8", mode: 0o600 });
  renameSync(tmp, path);
}

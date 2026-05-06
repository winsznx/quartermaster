/**
 * Storage helpers for ~/.zerion/quartermaster/ — PRD §13.
 *
 * NOT an upstream file. Lives at cli/lib/qm/ (Quartermaster scope) to keep
 * upstream cli/cli/ untouched.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const QM_DIR = join(homedir(), ".zerion", "quartermaster");

/**
 * Resolve a Quartermaster file path under ~/.zerion/quartermaster/.
 * Override the root via env QM_HOME (used by tests for sandboxing).
 */
export function qmPath(...segments) {
  const root = process.env.QM_HOME || QM_DIR;
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

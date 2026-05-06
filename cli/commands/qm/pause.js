/**
 * `zerion qm pause` — write a `paused` flag file. The running daemon checks
 * this each tick and skips execution when present (still emits tick events
 * for visibility).
 */

import { print, printError } from "../../cli/lib/util/output.js";

import { qmPath, writeJsonAtomic } from "../../lib/qm/storage.js";

export default async function qmPause(_args, _flags) {
  try {
    writeJsonAtomic(qmPath("paused"), { pausedAt: new Date().toISOString() });
    print({ paused: true });
  } catch (err) {
    printError(err.code || "pause_failed", err.message);
    process.exit(1);
  }
}

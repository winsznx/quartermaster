/**
 * Append-only ledger writer + tail reader — PRD §13.
 *
 * Every state change in Quartermaster becomes one or more LedgerEvent records
 * (Phase 2 discriminated union). Records are JSONL — one event per line in
 * `~/.zerion/quartermaster/ledger.jsonl`.
 *
 * Atomicity:
 * - Append uses `fs.openSync(path, "a")` per PRD §13.2 — POSIX guarantees
 *   the entire `write()` is contiguous when payload is < PIPE_BUF (4KB on
 *   Linux/macOS). Our largest event (TopUpAction in topup_planned) is ~1KB.
 * - `appendOne` opens, writes, fsyncs, closes. The fsync is the real cost
 *   — kept narrow to that one syscall. Phase 4 uses sync IO for simplicity;
 *   if tickbeat blocks on fsync the daemon is overloaded anyway.
 *
 * Rotation:
 * - At 50MB the file is renamed to `ledger-YYYY-MM-DD.jsonl.gz` per PRD §13.1.
 * - Compression runs in a child process (gzip) so we don't block the tick
 *   loop. If gzip is unavailable the rename succeeds and the .gz is just a
 *   plain file (acceptable for the hackathon — owner can compress later).
 */

import {
  closeSync,
  createReadStream,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeSync,
} from "node:fs";
import { dirname } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import { LedgerEvent } from "@quartermaster/shared-schemas";

import { qmPath } from "./storage.js";

const ROTATE_BYTES = 50 * 1024 * 1024;

function ledgerPath() {
  return qmPath("ledger.jsonl");
}

function ensureDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

/**
 * Append a LedgerEvent. Validates the event against the discriminated union
 * before writing — a malformed event throws and is NEVER persisted.
 */
export function appendEvent(event) {
  const validated = LedgerEvent.parse(event);
  const path = ledgerPath();
  ensureDir(path);

  const line = `${JSON.stringify(validated)}\n`;
  // Rotate BEFORE the append if the next write would push us past the
  // threshold — avoids writing the trigger event into the rotated file.
  rotateIfNeeded(path, line.length);

  const fd = openSync(path, "a", 0o600);
  try {
    writeSync(fd, line);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  return validated;
}

/**
 * Append many events in one open/sync cycle. Useful when a tick produces
 * a known batch (e.g., wallet_observed * fleet.length).
 */
export function appendMany(events) {
  if (events.length === 0) return [];
  const validated = events.map((e) => LedgerEvent.parse(e));
  const path = ledgerPath();
  ensureDir(path);

  const lines = validated.map((e) => `${JSON.stringify(e)}\n`).join("");
  rotateIfNeeded(path, lines.length);

  const fd = openSync(path, "a", 0o600);
  try {
    writeSync(fd, lines);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  return validated;
}

function fileSizeOrZero(path) {
  try {
    return statSync(path).size;
  } catch (err) {
    if (err && err.code === "ENOENT") return 0;
    throw err;
  }
}

function rotateIfNeeded(path, incomingBytes) {
  const size = fileSizeOrZero(path);
  if (size + incomingBytes < ROTATE_BYTES) return;

  const stamp = new Date().toISOString().slice(0, 10);
  const archive = path.replace(/\.jsonl$/, `-${stamp}.jsonl`);
  renameSync(path, archive);

  // Best-effort gzip in the background; the tick loop does not wait.
  try {
    const child = spawn("gzip", ["-9", archive], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch {
    // gzip not on PATH — leave the .jsonl as-is. Owner can compress later.
  }
}

/**
 * Stream-read all events. Returns an async iterator so callers can process
 * lazily without loading the whole file into memory. Skips blank lines and
 * lines that fail to parse — a corrupt line never poisons the rest.
 *
 * `corruptionHandler` is called once per bad line if provided.
 */
export async function* tail(options = {}) {
  const path = options.path || ledgerPath();
  const onCorruption = options.onCorruption;
  let exists = true;
  try {
    statSync(path);
  } catch (err) {
    if (err && err.code === "ENOENT") exists = false;
    else throw err;
  }
  if (!exists) return;

  const rl = createInterface({
    input: createReadStream(path, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });
  let lineNum = 0;
  for await (const raw of rl) {
    lineNum += 1;
    if (raw.length === 0) continue;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      if (typeof onCorruption === "function") {
        onCorruption({ lineNum, raw, error: err });
      }
      continue;
    }
    const result = LedgerEvent.safeParse(parsed);
    if (!result.success) {
      if (typeof onCorruption === "function") {
        onCorruption({ lineNum, raw, error: result.error });
      }
      continue;
    }
    yield result.data;
  }
}

/**
 * Read all events into an array. Convenience for tests / small ledgers.
 * For prod use prefer `tail()`.
 */
export async function readAll(options) {
  const out = [];
  for await (const ev of tail(options)) out.push(ev);
  return out;
}

/**
 * List archived ledger files (`ledger-YYYY-MM-DD.jsonl[.gz]`).
 */
export function listArchives() {
  const dir = dirname(ledgerPath());
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (err) {
    if (err && err.code === "ENOENT") return [];
    throw err;
  }
  return entries
    .filter((e) => /^ledger-\d{4}-\d{2}-\d{2}\.jsonl(\.gz)?$/.test(e))
    .sort();
}

/**
 * Read raw line count of the active file — used by tests + telemetry.
 */
export function activeLineCount() {
  const path = ledgerPath();
  try {
    const raw = readFileSync(path, "utf-8");
    if (raw.length === 0) return 0;
    return raw.split("\n").filter((l) => l.length > 0).length;
  } catch (err) {
    if (err && err.code === "ENOENT") return 0;
    throw err;
  }
}

export const __testing = { ROTATE_BYTES };

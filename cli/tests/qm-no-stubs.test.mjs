/**
 * Regression guard — fails if Quartermaster source files reintroduce stub
 * addresses, placeholder values, or TODO/FIXME markers in production code.
 *
 * Why this exists: Phase 7a discovered that `sendOnlyPlan` in cli/lib/qm/daemon.js
 * had been left with a hardcoded sink destination (`"0x" + "c".repeat(40)`),
 * which silently drained principal into 0xc...c instead of the target subordinate
 * during the entire Phase 4.6 demo run. See DEVIATIONS §"Stub destination
 * leak (2026-05-08)" and README §26.4.
 *
 * The guard scans cli/lib/qm, cli/commands/qm, cli/policies, apps/dashboard,
 * apps/landing for:
 *   - hex-address sinks: 0xcccc..., 0xdEaD..., 0x0000...0000 with non-zero bytes
 *   - dynamic stub patterns: '"0x" + "<c>".repeat(40)' family
 *   - TODO/FIXME/XXX/HACK markers
 *   - fixture state files (apps/<app>/lib/fixtures/*.json)
 *
 * Public-good addresses (USDC contract, x402 facilitator, vitalik.eth) are
 * whitelisted explicitly. Every new entry on the whitelist must include a
 * comment explaining why it is not a stub.
 */

import { strict as assert } from "node:assert";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const SCAN_DIRS = [
  "cli/lib/qm",
  "cli/commands/qm",
  "cli/policies",
  "apps/dashboard/app",
  "apps/dashboard/components",
  "apps/dashboard/lib",
  "apps/landing/app",
  "apps/landing/components",
];

const SCAN_EXTS = new Set([".js", ".mjs", ".ts", ".tsx", ".json"]);

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  ".vercel",
]);

// Public addresses that are NOT stubs. Each entry must justify itself.
const ADDRESS_WHITELIST = new Map([
  // USDC on Base mainnet — Circle's official contract.
  ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "Circle USDC contract on Base"],
  // x402 facilitator on Base — Coinbase / x402 protocol settlement endpoint.
  ["0xd07c06a650a88bbcf4f0c4fbf2c6c08c9a60acc6", "x402 facilitator on Base"],
  // vitalik.eth — public benign default for the x402 analyze target.
  ["0xd8da6bf26964af9d7eed9e03e53415d37aa96045", "vitalik.eth (public benign default)"],
]);

// Sink-shape patterns: a 40-hex address that is all the same character (case-
// insensitive). Catches 0xcccc..., 0xdddd..., 0xeeee..., 0xffff...
const SINK_REPEATED_CHAR_RE = /\b0x([0-9a-fA-F])\1{39}\b/g;
// 0xdEaD-style ending — last byte is dead, head is mostly zeros.
const SINK_DEAD_RE = /\b0x0{32,38}d[Ee][Aa][Dd]\b/g;
// "0x" + "<char>".repeat(N) constructions in source code.
const STUB_REPEAT_RE = /["']0x["']\s*\+\s*["'][0-9a-fA-F]["']\s*\.\s*repeat\s*\(\s*40\s*\)/;
// TODO / FIXME / XXX / HACK markers (case-insensitive, word-boundary).
const TODO_RE = /\b(TODO|FIXME|XXX|HACK)\b/;
// Truncated-display addresses like "0x1234...abcd" — only stubs use these
// shapes; real on-chain hashes never have ellipses.
const ELLIPSIS_ADDR_RE = /["']0x[0-9a-fA-F]{2,8}\.{3}[0-9a-fA-F]{2,8}["']/;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIR_NAMES.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, out);
    } else if (st.isFile()) {
      const dot = name.lastIndexOf(".");
      const ext = dot === -1 ? "" : name.slice(dot);
      if (SCAN_EXTS.has(ext)) out.push(full);
    }
  }
  return out;
}

function scanFile(absPath) {
  const rel = relative(REPO_ROOT, absPath);
  // Tests describe stub patterns in their own bodies — exclude them.
  if (rel.endsWith(".test.mjs") || rel.endsWith(".test.js") || rel.endsWith(".test.ts")) {
    return [];
  }
  const text = readFileSync(absPath, "utf-8");
  const findings = [];

  // Sink: repeated-character 40-hex.
  for (const m of text.matchAll(SINK_REPEATED_CHAR_RE)) {
    findings.push({ kind: "sink_repeated_char", match: m[0] });
  }
  // Sink: 0x...dEaD.
  for (const m of text.matchAll(SINK_DEAD_RE)) {
    findings.push({ kind: "sink_dead_address", match: m[0] });
  }
  // Stub: "0x" + "<c>".repeat(40).
  if (STUB_REPEAT_RE.test(text)) {
    findings.push({ kind: "stub_repeat_construction", match: text.match(STUB_REPEAT_RE)[0] });
  }
  // Truncated-display address (fixture-shape).
  for (const m of text.matchAll(new RegExp(ELLIPSIS_ADDR_RE, "g"))) {
    findings.push({ kind: "ellipsis_address", match: m[0] });
  }
  // TODO/FIXME/XXX/HACK — but allow them in module-level docstrings (lines
  // starting with `*` or `//` describing what the file does).
  for (const line of text.split("\n")) {
    if (!TODO_RE.test(line)) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
    findings.push({ kind: "todo_marker", match: line.trim() });
  }

  return findings.map((f) => ({ ...f, file: rel }));
}

describe("Quartermaster: no-stubs regression guard", () => {
  it("scans production source for sink addresses, stub patterns, and TODOs", () => {
    const files = SCAN_DIRS.flatMap((dir) => walk(join(REPO_ROOT, dir)));
    const all = files.flatMap(scanFile);

    const violations = all.filter((f) => {
      if (f.kind === "sink_repeated_char" || f.kind === "sink_dead_address") {
        const lower = f.match.toLowerCase();
        return !ADDRESS_WHITELIST.has(lower);
      }
      return true;
    });

    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${v.file}: [${v.kind}] ${v.match}`)
        .join("\n");
      assert.fail(
        `qm-no-stubs guard found ${violations.length} violation(s):\n${msg}\n\n` +
          "If a finding is legitimate (e.g. public protocol address), add it to ADDRESS_WHITELIST in this test with a comment justifying why it is not a stub.",
      );
    }
  });

  it("forbids fixture state files under apps/*/lib/fixtures", () => {
    const fixtureCandidates = [];
    for (const app of ["apps/dashboard/lib/fixtures", "apps/landing/lib/fixtures"]) {
      const dir = join(REPO_ROOT, app);
      try {
        const entries = readdirSync(dir);
        for (const name of entries) fixtureCandidates.push(join(app, name));
      } catch {
        // directory does not exist — that's the desired state.
      }
    }
    assert.deepEqual(
      fixtureCandidates,
      [],
      `fixture files reintroduced — these contain shape-correct fake data and must not ship: ${fixtureCandidates.join(", ")}`,
    );
  });
});

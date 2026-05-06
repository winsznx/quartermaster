import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  activeLineCount,
  appendEvent,
  appendMany,
  listArchives,
  readAll,
} from "../lib/qm/ledger.js";

const VALID_UUID = "01926a3a-1234-7abc-8def-1234567890ab";
const VALID_TX = "0x" + "a".repeat(64);
const ISO = "2026-05-06T12:00:00Z";

let sandbox;
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "qm-ledger-test-"));
  process.env.QM_HOME = sandbox;
});
afterEach(() => {
  delete process.env.QM_HOME;
  rmSync(sandbox, { recursive: true, force: true });
});

describe("ledger", () => {
  it("appendEvent persists a tick_started event and tail reads it back", async () => {
    appendEvent({ type: "tick_started", tickId: "t-1", ts: ISO });
    const events = await readAll();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "tick_started");
    assert.equal(events[0].tickId, "t-1");
  });

  it("appendEvent rejects malformed events at the schema gate", () => {
    assert.throws(() => appendEvent({ type: "tick_started" }));
    // Should not have written a partial line
    assert.equal(activeLineCount(), 0);
  });

  it("appendMany batches multiple events", async () => {
    appendMany([
      { type: "tick_started", tickId: "t-1", ts: ISO },
      {
        type: "topup_blocked",
        actionId: VALID_UUID,
        reasonCode: "CAP_EXCEEDED",
        reasonText: "over cap",
      },
      { type: "tick_completed", tickId: "t-1", durationMs: 12, ts: ISO },
    ]);
    const events = await readAll();
    assert.equal(events.length, 3);
    assert.deepEqual(
      events.map((e) => e.type),
      ["tick_started", "topup_blocked", "tick_completed"],
    );
  });

  it("appendMany([]) is a no-op", async () => {
    appendMany([]);
    assert.equal(activeLineCount(), 0);
  });

  it("file is created with mode 0600", () => {
    appendEvent({ type: "tick_started", tickId: "t-1", ts: ISO });
    const path = join(sandbox, "ledger.jsonl");
    const mode = statSync(path).mode & 0o777;
    assert.equal(mode, 0o600);
  });

  it("tail skips corrupt lines and reports them via onCorruption", async () => {
    appendEvent({ type: "tick_started", tickId: "t-1", ts: ISO });
    // Corrupt the file by appending non-JSON
    const path = join(sandbox, "ledger.jsonl");
    const fs = await import("node:fs");
    fs.appendFileSync(path, "not-json\n");
    appendEvent({ type: "tick_completed", tickId: "t-1", durationMs: 1, ts: ISO });

    const corruption = [];
    const events = [];
    const { tail } = await import("../lib/qm/ledger.js");
    for await (const ev of tail({ onCorruption: (c) => corruption.push(c) })) {
      events.push(ev);
    }
    assert.equal(events.length, 2);
    assert.equal(corruption.length, 1);
    assert.equal(corruption[0].lineNum, 2);
  });

  it("readAll on missing file returns []", async () => {
    const events = await readAll();
    assert.deepEqual(events, []);
  });

  it("listArchives returns [] when no rotation has happened", () => {
    appendEvent({ type: "tick_started", tickId: "t-1", ts: ISO });
    assert.deepEqual(listArchives(), []);
  });

  it("preserves order across appendEvent + appendMany interleaving", async () => {
    appendEvent({ type: "tick_started", tickId: "t-1", ts: ISO });
    appendMany([
      {
        type: "wallet_observed",
        walletId: "demo-1",
        sample: {
          walletId: "demo-1",
          usdcBalance: 5,
          sampledAt: ISO,
          last24hSpend: 6,
          last7dSpend: 42,
          ewmaHourlyBurn: 0.5,
          runwayHours: 10,
        },
      },
    ]);
    appendEvent({ type: "tick_completed", tickId: "t-1", durationMs: 1, ts: ISO });
    const events = await readAll();
    assert.deepEqual(
      events.map((e) => e.type),
      ["tick_started", "wallet_observed", "tick_completed"],
    );
  });

  it("rotates when next write would cross 50MB and the trigger event lands in fresh file", async () => {
    // We can't easily write 50MB in a unit test, so we monkey-patch the
    // threshold via environment? The module-level constant is exported from
    // __testing for visibility but not mutable. Instead we forge a "near-
    // limit" file by writing a sparse stub then triggering rotation.
    const path = join(sandbox, "ledger.jsonl");
    const fs = await import("node:fs");
    // Pre-populate with a 50MB+ file to force rotation on next append.
    const big = Buffer.alloc(51 * 1024 * 1024, 0x20); // 51 MiB of spaces — big enough
    fs.writeFileSync(path, big);

    appendEvent({ type: "tick_started", tickId: "t-rotate", ts: ISO });

    // gzip is fired-and-forgotten in the background; after rename we MAY see
    // either just the renamed `.jsonl` or both `.jsonl` and `.jsonl.gz` (gzip
    // mid-compress) or just `.jsonl.gz` (gzip completed and removed source).
    // We only assert at LEAST one archive exists.
    const archives = listArchives();
    assert.ok(archives.length >= 1, `expected >= 1 archive, got ${archives.length}`);
    for (const a of archives) {
      assert.match(a, /^ledger-\d{4}-\d{2}-\d{2}\.jsonl(\.gz)?$/);
    }

    // The triggering event should have landed in the fresh active file
    const events = await readAll();
    assert.equal(events.length, 1, `expected 1 event in active file, got ${events.length}: ${JSON.stringify(events)}`);
    assert.equal(events[0].tickId, "t-rotate");
  });
});

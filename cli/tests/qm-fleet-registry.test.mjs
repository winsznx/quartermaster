/**
 * QM-scope test (NOT upstream). Lives under cli/tests/ so upstream's
 * `node --test tests/*.test.mjs` picks it up; the qm- prefix tags it as ours.
 */

import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  addWallet,
  getWallet,
  listWallets,
  loadFleet,
  removeWallet,
  saveFleet,
} from "../lib/fleet/registry.js";

const validAddress = "0x1234567890123456789012345678901234567890";
const validIso = "2026-05-06T00:00:00Z";

const exampleWallet = {
  id: "demo-1",
  address: validAddress,
  chainId: "eip155:8453",
  targetRunwayHours: 72,
  minRunwayHours: 24,
  minUsdcBalance: 5,
  createdAt: validIso,
};

let sandbox;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "qm-fleet-test-"));
  process.env.QM_HOME = sandbox;
});

afterEach(() => {
  delete process.env.QM_HOME;
  rmSync(sandbox, { recursive: true, force: true });
});

describe("fleet registry", () => {
  it("loadFleet returns [] when fleet.json does not exist", () => {
    assert.deepEqual(loadFleet(), []);
  });

  it("addWallet persists and round-trips", () => {
    addWallet(exampleWallet);
    assert.deepEqual(loadFleet(), [exampleWallet]);
  });

  it("addWallet rejects duplicate id", () => {
    addWallet(exampleWallet);
    assert.throws(
      () => addWallet({ ...exampleWallet, address: validAddress }),
      /already exists/,
    );
  });

  it("addWallet validates against schema (rejects bad address)", () => {
    assert.throws(() =>
      addWallet({ ...exampleWallet, address: "not-an-address" }),
    );
  });

  it("getWallet finds a registered wallet", () => {
    addWallet(exampleWallet);
    assert.deepEqual(getWallet("demo-1"), exampleWallet);
  });

  it("getWallet returns undefined for unknown id", () => {
    assert.equal(getWallet("nope"), undefined);
  });

  it("removeWallet returns true when removed, false when missing", () => {
    addWallet(exampleWallet);
    assert.equal(removeWallet("demo-1"), true);
    assert.equal(removeWallet("demo-1"), false);
    assert.deepEqual(loadFleet(), []);
  });

  it("listWallets filters by chainId", () => {
    addWallet(exampleWallet);
    addWallet({ ...exampleWallet, id: "demo-2", chainId: "eip155:1" });
    assert.equal(listWallets({ chainId: "eip155:1" }).length, 1);
    assert.equal(listWallets({ chainId: "eip155:8453" }).length, 1);
    assert.equal(listWallets().length, 2);
  });

  it("saveFleet writes JSON with mode 0600 and a trailing newline", () => {
    saveFleet([exampleWallet]);
    const raw = readFileSync(join(sandbox, "fleet.json"), "utf-8");
    assert.ok(raw.endsWith("\n"));
    assert.deepEqual(JSON.parse(raw), [exampleWallet]);
  });

  it("loadFleet throws on schema-invalid file (catches hand-edit corruption)", () => {
    saveFleet([]);
    writeFileSync(join(sandbox, "fleet.json"), JSON.stringify([{ id: "BAD" }]));
    assert.throws(() => loadFleet());
  });
});

/**
 * QM-scope test (NOT upstream).
 */

import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  addSource,
  getSource,
  listSources,
  loadSources,
  saveSources,
} from "../lib/treasury/sources.js";

const validAddress = "0x9876543210987654321098765432109876543210";
const validIso = "2026-05-06T00:00:00Z";

const exampleSource = {
  id: "usdc-idle",
  walletAddress: validAddress,
  chainId: "eip155:8453",
  assetContract: validAddress,
  symbol: "USDC",
  currentApyEstimate: 0,
  apyLastUpdated: validIso,
  minRetainedBalance: 100,
  priority: 1,
};

let sandbox;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "qm-treasury-test-"));
  process.env.QM_HOME = sandbox;
});

afterEach(() => {
  delete process.env.QM_HOME;
  rmSync(sandbox, { recursive: true, force: true });
});

describe("treasury registry", () => {
  it("loadSources returns [] when treasury.json does not exist", () => {
    assert.deepEqual(loadSources(), []);
  });

  it("addSource persists and round-trips", () => {
    addSource(exampleSource);
    assert.deepEqual(loadSources(), [exampleSource]);
  });

  it("addSource rejects duplicate id", () => {
    addSource(exampleSource);
    assert.throws(
      () => addSource({ ...exampleSource }),
      /already exists/,
    );
  });

  it("addSource accepts assetContract: 'native'", () => {
    addSource({ ...exampleSource, assetContract: "native" });
    assert.equal(getSource("usdc-idle").assetContract, "native");
  });

  it("addSource validates symbol bounds", () => {
    assert.throws(() =>
      addSource({ ...exampleSource, id: "bad", symbol: "" }),
    );
  });

  it("addSource enforces non-negative APY", () => {
    assert.throws(() =>
      addSource({ ...exampleSource, id: "bad", currentApyEstimate: -1 }),
    );
  });

  it("listSources returns the persisted array", () => {
    addSource(exampleSource);
    addSource({ ...exampleSource, id: "aave-usdc", priority: 2 });
    assert.equal(listSources().length, 2);
  });

  it("saveSources accepts an empty array", () => {
    saveSources([]);
    assert.deepEqual(loadSources(), []);
  });
});

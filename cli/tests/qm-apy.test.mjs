import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  applyApyToSources,
  getCachedApy,
  loadCache,
  refreshApy,
  saveCache,
  __testing,
} from "../lib/qm/apy.js";

const validAddress = "0x9876543210987654321098765432109876543210";
const ISO = "2026-05-06T12:00:00Z";

function makeSource(overrides = {}) {
  return {
    id: "usdc-idle",
    walletAddress: validAddress,
    chainId: "eip155:8453",
    assetContract: "native",
    symbol: "USDC",
    currentApyEstimate: 0,
    apyLastUpdated: ISO,
    minRetainedBalance: 0,
    priority: 1,
    ...overrides,
  };
}

let sandbox;
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "qm-apy-test-"));
  process.env.QM_HOME = sandbox;
});
afterEach(() => {
  delete process.env.QM_HOME;
  rmSync(sandbox, { recursive: true, force: true });
});

describe("apy", () => {
  it("loadCache returns {} when file missing", () => {
    assert.deepEqual(loadCache(), {});
  });

  it("saveCache + loadCache round-trip", () => {
    saveCache({ a: { apy: 0.05, updatedAt: ISO } });
    assert.deepEqual(loadCache(), { a: { apy: 0.05, updatedAt: ISO } });
  });

  it("getCachedApy returns null when missing", () => {
    assert.equal(getCachedApy("missing"), null);
  });

  it("getCachedApy returns null when stale (over 1h old)", () => {
    saveCache({
      a: {
        apy: 0.05,
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    });
    assert.equal(getCachedApy("a"), null);
  });

  it("getCachedApy returns the value when fresh", () => {
    saveCache({ a: { apy: 0.05, updatedAt: new Date().toISOString() } });
    assert.equal(getCachedApy("a"), 0.05);
  });

  it("refreshApy fetches missing entries and persists", async () => {
    const source = makeSource();
    const fetcher = async () => 0.032;
    const { cache, errors } = await refreshApy([source], fetcher);
    assert.equal(errors.length, 0);
    assert.equal(cache["usdc-idle"].apy, 0.032);
    assert.deepEqual(loadCache()["usdc-idle"].apy, 0.032);
  });

  it("refreshApy preserves fresh entries (does not call fetcher)", async () => {
    saveCache({ "usdc-idle": { apy: 0.05, updatedAt: new Date().toISOString() } });
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return 0.99;
    };
    await refreshApy([makeSource()], fetcher);
    assert.equal(calls, 0);
    assert.equal(loadCache()["usdc-idle"].apy, 0.05);
  });

  it("refreshApy refreshes stale entries", async () => {
    saveCache({
      "usdc-idle": {
        apy: 0.05,
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    });
    const fetcher = async () => 0.04;
    await refreshApy([makeSource()], fetcher);
    assert.equal(loadCache()["usdc-idle"].apy, 0.04);
  });

  it("refreshApy keeps stale entry on fetcher error and reports error", async () => {
    saveCache({
      "usdc-idle": {
        apy: 0.05,
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    });
    const fetcher = async () => {
      throw new Error("zerion api 502");
    };
    const { errors } = await refreshApy([makeSource()], fetcher);
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /502/);
    assert.equal(loadCache()["usdc-idle"].apy, 0.05);
  });

  it("refreshApy rejects fetcher returning non-number", async () => {
    const fetcher = async () => "0.05";
    const { errors } = await refreshApy([makeSource()], fetcher);
    assert.equal(errors.length, 1);
  });

  it("applyApyToSources overlays cached APY where fresh", () => {
    saveCache({
      "usdc-idle": { apy: 0.04, updatedAt: new Date().toISOString() },
    });
    const sources = [makeSource({ currentApyEstimate: 0 })];
    const result = applyApyToSources(sources);
    assert.equal(result[0].currentApyEstimate, 0.04);
    assert.notEqual(result[0].apyLastUpdated, ISO);
  });

  it("applyApyToSources passes through unchanged when cache is stale", () => {
    saveCache({
      "usdc-idle": {
        apy: 0.99,
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    });
    const sources = [makeSource({ currentApyEstimate: 0 })];
    const result = applyApyToSources(sources);
    assert.equal(result[0].currentApyEstimate, 0);
  });

  it("REFRESH_TTL_MS is 1 hour", () => {
    assert.equal(__testing.REFRESH_TTL_MS, 60 * 60 * 1000);
  });
});

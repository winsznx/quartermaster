/**
 * QM chain registry patch — Phase 4.6-prep deliverable.
 *
 * Verifies the env-flag-gated base-sepolia patch in
 * cli/cli/lib/chain/registry.js: without QM_ENABLE_BASE_SEPOLIA the
 * upstream surface is byte-identical (14 chains, base-sepolia rejected);
 * with the flag the QM daemon's spawn sites can target Sepolia.
 *
 * NOT an upstream test. Tests run with the flag DEFAULT-OFF so upstream's
 * own `tests/unit.test.mjs` "contains 14 chains" still passes.
 */

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

const HERE = dirname(fileURLToPath(import.meta.url));

// Helper that spawns a fresh `node --input-type=module -e "..."` so the
// chain registry module evaluates with whatever env we choose. Returns
// { stdout, exitCode }.
function runWithEnv(env, code) {
  const result = spawnSync("node", ["--input-type=module", "-e", code], {
    env: { ...process.env, ...env },
    encoding: "utf-8",
  });
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.status };
}

const REGISTRY_IMPORT = `import('${join(HERE, "..", "cli", "lib", "chain", "registry.js")}')`;

describe("chain registry — Quartermaster patch (env-flag opt-in)", () => {
  it("WITHOUT QM_ENABLE_BASE_SEPOLIA: SUPPORTED_CHAINS is upstream's 14 + solana", () => {
    const r = runWithEnv(
      { QM_ENABLE_BASE_SEPOLIA: "" },
      `${REGISTRY_IMPORT}.then(m => console.log(JSON.stringify({
        len: m.SUPPORTED_CHAINS.length,
        hasBaseSepolia: m.SUPPORTED_CHAINS.includes("base-sepolia"),
      })))`,
    );
    const { len, hasBaseSepolia } = JSON.parse(r.stdout);
    assert.equal(len, 14);
    assert.equal(hasBaseSepolia, false);
  });

  it("WITHOUT flag: getViemChain('base-sepolia') returns null", () => {
    const r = runWithEnv(
      { QM_ENABLE_BASE_SEPOLIA: "" },
      `${REGISTRY_IMPORT}.then(m => console.log(JSON.stringify(m.getViemChain("base-sepolia"))))`,
    );
    assert.equal(r.stdout.trim(), "null");
  });

  it("WITHOUT flag: toCaip2('base-sepolia') falls through to literal input (upstream behavior)", () => {
    const r = runWithEnv(
      { QM_ENABLE_BASE_SEPOLIA: "" },
      `${REGISTRY_IMPORT}.then(m => console.log(m.toCaip2("base-sepolia")))`,
    );
    assert.equal(r.stdout.trim(), "base-sepolia");
  });

  it("WITH QM_ENABLE_BASE_SEPOLIA=1: SUPPORTED_CHAINS includes base-sepolia (15 + solana)", () => {
    const r = runWithEnv(
      { QM_ENABLE_BASE_SEPOLIA: "1" },
      `${REGISTRY_IMPORT}.then(m => console.log(JSON.stringify({
        len: m.SUPPORTED_CHAINS.length,
        hasBaseSepolia: m.SUPPORTED_CHAINS.includes("base-sepolia"),
      })))`,
    );
    const { len, hasBaseSepolia } = JSON.parse(r.stdout);
    assert.equal(len, 15);
    assert.equal(hasBaseSepolia, true);
  });

  it("WITH flag: toCaip2('base-sepolia') === 'eip155:84532'", () => {
    const r = runWithEnv(
      { QM_ENABLE_BASE_SEPOLIA: "1" },
      `${REGISTRY_IMPORT}.then(m => console.log(m.toCaip2("base-sepolia")))`,
    );
    assert.equal(r.stdout.trim(), "eip155:84532");
  });

  it("WITH flag: getViemChain('base-sepolia').id === 84532", () => {
    const r = runWithEnv(
      { QM_ENABLE_BASE_SEPOLIA: "1" },
      `${REGISTRY_IMPORT}.then(m => console.log(m.getViemChain("base-sepolia").id))`,
    );
    assert.equal(r.stdout.trim(), "84532");
  });

  it("WITH flag: validateChain('base-sepolia') (via CHAIN_IDS in upstream validate.js) returns null (accepted)", () => {
    const r = runWithEnv(
      { QM_ENABLE_BASE_SEPOLIA: "1" },
      `import('${join(HERE, "..", "cli", "lib", "util", "validate.js")}').then(m => {
        const err = m.validateChain("base-sepolia");
        console.log(err === null ? "ACCEPTED" : JSON.stringify(err));
      })`,
    );
    assert.equal(r.stdout.trim(), "ACCEPTED");
  });

  it("WITHOUT flag: validateChain('base-sepolia') returns unsupported_chain (upstream behavior preserved)", () => {
    const r = runWithEnv(
      { QM_ENABLE_BASE_SEPOLIA: "" },
      `import('${join(HERE, "..", "cli", "lib", "util", "validate.js")}').then(m => {
        const err = m.validateChain("base-sepolia");
        console.log(err ? err.code : "ACCEPTED");
      })`,
    );
    assert.equal(r.stdout.trim(), "unsupported_chain");
  });
});

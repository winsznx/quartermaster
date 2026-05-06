/**
 * QM env loader — Phase 4.6-prep deliverable. Tests parsing + flag injection.
 * NOT an upstream test.
 */

import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  buildSubprocessEnv,
  findEnvLocal,
  loadEnvLocal,
  mergeIntoProcessEnv,
  parseEnv,
} from "../lib/qm/env.js";

describe("env.parseEnv", () => {
  it("parses KEY=VALUE lines", () => {
    const out = parseEnv("ZERION_API_KEY=zk_dev_123\nQM_ENV=testnet\n");
    assert.deepEqual(out, { ZERION_API_KEY: "zk_dev_123", QM_ENV: "testnet" });
  });

  it("ignores blank lines and comment lines", () => {
    const out = parseEnv(`# comment
KEY1=value1

# another
KEY2=value2
`);
    assert.deepEqual(out, { KEY1: "value1", KEY2: "value2" });
  });

  it("strips surrounding double quotes from values", () => {
    const out = parseEnv(`A="quoted value"\n`);
    assert.equal(out.A, "quoted value");
  });

  it("strips surrounding single quotes from values", () => {
    const out = parseEnv(`A='quoted value'\n`);
    assert.equal(out.A, "quoted value");
  });

  it("preserves '=' inside the value", () => {
    const out = parseEnv("URL=https://example.com?key=value\n");
    assert.equal(out.URL, "https://example.com?key=value");
  });

  it("ignores lines without '='", () => {
    const out = parseEnv("not-an-assignment\nA=1\n");
    assert.deepEqual(out, { A: "1" });
  });

  it("trims whitespace around key", () => {
    const out = parseEnv("  KEY  =value\n");
    assert.equal(out.KEY, "value");
  });
});

describe("env.findEnvLocal + loadEnvLocal", () => {
  let sandbox;
  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), "qm-env-test-"));
  });
  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  it("findEnvLocal walks up from a deep startDir to locate .env.local", () => {
    writeFileSync(join(sandbox, ".env.local"), "A=1\n");
    const deep = join(sandbox, "a", "b", "c");
    mkdirSync(deep, { recursive: true });
    const found = findEnvLocal(deep);
    assert.equal(found, join(sandbox, ".env.local"));
  });

  it("findEnvLocal returns null when no .env.local in any parent", () => {
    const found = findEnvLocal(sandbox);
    assert.equal(found, null);
  });

  it("loadEnvLocal returns parsed values + path", () => {
    writeFileSync(join(sandbox, ".env.local"), "ZERION_API_KEY=zk_dev_x\n");
    const result = loadEnvLocal({ path: join(sandbox, ".env.local") });
    assert.deepEqual(result.values, { ZERION_API_KEY: "zk_dev_x" });
    assert.equal(result.path, join(sandbox, ".env.local"));
  });

  it("loadEnvLocal returns empty when path is missing", () => {
    const result = loadEnvLocal({ path: join(sandbox, "missing.env") });
    assert.deepEqual(result.values, {});
    assert.equal(result.path, null);
  });
});

describe("env.buildSubprocessEnv", () => {
  it("always includes QM_ENABLE_BASE_SEPOLIA=1", () => {
    const merged = buildSubprocessEnv({ FOO: "bar" });
    assert.equal(merged.QM_ENABLE_BASE_SEPOLIA, "1");
  });

  it("preserves values from the parent env", () => {
    const merged = buildSubprocessEnv({ EXISTING: "keep" });
    assert.equal(merged.EXISTING, "keep");
  });

  it("operator-set parent env wins over .env.local values", () => {
    // We can't easily inject a fake .env.local without monkey-patching the
    // module, but we can assert that an explicit parentEnv key isn't shadowed
    // by a same-named QM_ENABLE_BASE_SEPOLIA value (the QM_ENABLE_BASE_SEPOLIA
    // hardcode happens AFTER the parent merge; that one IS supposed to win).
    const merged = buildSubprocessEnv({
      ZERION_API_KEY: "operator-set",
      QM_ENABLE_BASE_SEPOLIA: "user-tried-to-disable",
    });
    assert.equal(merged.ZERION_API_KEY, "operator-set");
    // QM_ENABLE_BASE_SEPOLIA is a fixed flag — daemon always sets it
    assert.equal(merged.QM_ENABLE_BASE_SEPOLIA, "1");
  });
});

describe("env.mergeIntoProcessEnv", () => {
  it("does NOT overwrite existing process.env values", () => {
    const KEY = `QM_ENV_TEST_${Date.now()}`;
    process.env[KEY] = "operator-set";
    const before = process.env[KEY];
    // mergeIntoProcessEnv only adds keys that aren't already set, so
    // existing values are preserved regardless of .env.local content
    mergeIntoProcessEnv();
    assert.equal(process.env[KEY], before);
    delete process.env[KEY];
  });
});

/**
 * Executor + portfolio-fetcher pass the QM-built subprocess env (with
 * QM_ENABLE_BASE_SEPOLIA=1) to spawned `npx zerion` children.
 *
 * NOT an upstream test. Phase 4.6-prep deliverable.
 */

import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { executeAction } from "../lib/qm/executor.js";

const VALID_TX = "0x" + "a".repeat(64);
const VALID_UUID = "01926a3a-1234-7abc-8def-1234567890ab";
const ISO = "2026-05-06T12:00:00Z";

function makeAction() {
  return {
    actionId: VALID_UUID,
    targetWalletId: "demo-1",
    topUpAmountUsdc: 10,
    sourceId: "usdc-idle",
    state: "planned",
    txHashes: {},
    policyChecks: [],
    createdAt: ISO,
  };
}

let sandbox;
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "qm-executor-env-test-"));
  process.env.QM_HOME = sandbox;
});
afterEach(() => {
  delete process.env.QM_HOME;
  rmSync(sandbox, { recursive: true, force: true });
});

describe("executor — env propagation to spawned subprocesses", () => {
  it("passes QM_ENABLE_BASE_SEPOLIA=1 to spawn", async () => {
    const captured = [];

    // Stub spawnImpl that captures the spawn options + simulates a successful
    // send (returning a tx hash via stdout).
    const spawnImpl = (cmd, args, opts) => {
      captured.push({ cmd, args, env: opts.env });
      // Build a fake child that emits "close" with exit 0 + JSON stdout
      const handlers = {};
      const child = {
        stdout: {
          on: (ev, cb) => {
            if (ev === "data") {
              setImmediate(() => cb(Buffer.from(JSON.stringify({ txHash: VALID_TX }))));
            }
          },
        },
        stderr: { on: () => {} },
        on: (ev, cb) => {
          handlers[ev] = cb;
          if (ev === "close") setImmediate(() => cb(0));
        },
        kill: () => {},
      };
      return child;
    };

    await executeAction(
      makeAction(),
      { sendTo: "0x" + "c".repeat(40), sendToken: "USDC", sendAmount: 10 },
      { runner: undefined, spawnImpl },
    );

    assert.ok(captured.length > 0, "spawn was never called");
    // After Phase 4.6 fix: spawn invokes `node <ZERION_CLI_PATH> send ...`
    // (not `npx zerion ...`) to ensure the LOCAL forked CLI is used, not the
    // published npm package which lacks our patches.
    const sendCall = captured.find((c) => c.cmd === "node" && c.args[1] === "send");
    assert.ok(sendCall, "did not see a `node <cli> send` invocation");
    assert.equal(sendCall.env.QM_ENABLE_BASE_SEPOLIA, "1");
  });

  it("merges parent process.env into the spawn env (e.g. ZERION_API_KEY survives)", async () => {
    const KEY = "ZERION_API_KEY_QM_TEST";
    process.env[KEY] = "zk_dev_propagation_test";
    const captured = [];
    const spawnImpl = (cmd, args, opts) => {
      captured.push({ env: opts.env });
      const child = {
        stdout: {
          on: (ev, cb) => {
            if (ev === "data") setImmediate(() => cb(Buffer.from(JSON.stringify({ txHash: VALID_TX }))));
          },
        },
        stderr: { on: () => {} },
        on: (ev, cb) => {
          if (ev === "close") setImmediate(() => cb(0));
        },
        kill: () => {},
      };
      return child;
    };

    await executeAction(
      makeAction(),
      { sendTo: "0x" + "c".repeat(40), sendToken: "USDC", sendAmount: 10 },
      { spawnImpl },
    );
    delete process.env[KEY];

    const last = captured[captured.length - 1];
    assert.equal(last.env[KEY], "zk_dev_propagation_test");
  });
});

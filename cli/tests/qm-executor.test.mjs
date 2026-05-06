import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { executeAction } from "../lib/qm/executor.js";
import { readAll } from "../lib/qm/ledger.js";

const VALID_TX = "0x" + "a".repeat(64);
const VALID_TX2 = "0x" + "b".repeat(64);
const VALID_UUID = "01926a3a-1234-7abc-8def-1234567890ab";
const ISO = "2026-05-06T12:00:00Z";

function makeAction(overrides = {}) {
  return {
    actionId: VALID_UUID,
    targetWalletId: "demo-1",
    topUpAmountUsdc: 10,
    sourceId: "usdc-idle",
    state: "planned",
    txHashes: {},
    policyChecks: [],
    createdAt: ISO,
    ...overrides,
  };
}

function fakeRunner(scriptedResponses) {
  let i = 0;
  return async () => {
    if (i >= scriptedResponses.length) {
      throw new Error(`fakeRunner ran out of responses (call ${i + 1})`);
    }
    return scriptedResponses[i++];
  };
}

let sandbox;
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "qm-executor-test-"));
  process.env.QM_HOME = sandbox;
});
afterEach(() => {
  delete process.env.QM_HOME;
  rmSync(sandbox, { recursive: true, force: true });
});

describe("executor", () => {
  it("send-only action: emits planned → send_pending → send_confirmed → confirmed", async () => {
    const runner = fakeRunner([{ txHash: VALID_TX }]);
    const result = await executeAction(makeAction(), {
      sendTo: "0x" + "c".repeat(40),
      sendToken: "USDC",
      sendAmount: 10,
    }, { runner });

    assert.equal(result.state, "confirmed");
    assert.equal(result.txHashes.send, VALID_TX);
    assert.ok(result.confirmedAt);

    const events = await readAll();
    assert.deepEqual(events.map((e) => e.type), [
      "topup_planned",
      "topup_send_pending",
      "topup_send_confirmed",
      "topup_confirmed",
    ]);
  });

  it("swap + send action: full transition path", async () => {
    const runner = fakeRunner([
      { txHash: VALID_TX, gasUsed: 21000 }, // swap
      { txHash: VALID_TX2 }, // send
    ]);
    const result = await executeAction(makeAction(), {
      swapFrom: "aUSDC",
      swapTo: "USDC",
      swapAmount: 10,
      sendTo: "0x" + "c".repeat(40),
      sendToken: "USDC",
      sendAmount: 10,
    }, { runner, requiresSwap: true });

    assert.equal(result.state, "confirmed");
    assert.equal(result.txHashes.swap, VALID_TX);
    assert.equal(result.txHashes.send, VALID_TX2);

    const events = await readAll();
    assert.deepEqual(events.map((e) => e.type), [
      "topup_planned",
      "topup_swap_pending",
      "topup_swap_confirmed",
      "topup_send_pending",
      "topup_send_confirmed",
      "topup_confirmed",
    ]);
  });

  it("subprocess error: marks action error + emits daemon_halt + rethrows", async () => {
    const runner = async () => {
      throw Object.assign(new Error("rpc 502"), { code: "subprocess_error" });
    };
    await assert.rejects(
      () =>
        executeAction(makeAction(), {
          sendTo: "0x" + "c".repeat(40),
          sendToken: "USDC",
          sendAmount: 10,
        }, { runner }),
      /rpc 502/,
    );

    const events = await readAll();
    assert.deepEqual(events.map((e) => e.type), [
      "topup_planned",
      "daemon_halt",
    ]);
  });

  it("invalid tx hash: rejects + halts", async () => {
    const runner = fakeRunner([{ txHash: "not-a-hash" }]);
    await assert.rejects(
      () =>
        executeAction(makeAction(), {
          sendTo: "0x" + "c".repeat(40),
          sendToken: "USDC",
          sendAmount: 10,
        }, { runner }),
      /no tx hash/,
    );
  });

  it("topup_planned written BEFORE first tx (idempotency, PRD §6.4)", async () => {
    let observedBeforeRun = null;
    const runner = async () => {
      observedBeforeRun = await readAll();
      return { txHash: VALID_TX };
    };
    await executeAction(makeAction(), {
      sendTo: "0x" + "c".repeat(40),
      sendToken: "USDC",
      sendAmount: 10,
    }, { runner });

    assert.ok(observedBeforeRun);
    assert.equal(observedBeforeRun.length, 1);
    assert.equal(observedBeforeRun[0].type, "topup_planned");
  });

  it("rejects malformed planned action at the schema gate", async () => {
    await assert.rejects(
      () =>
        executeAction(
          { ...makeAction(), actionId: "not-a-uuid" },
          { sendTo: "0x" + "c".repeat(40), sendToken: "USDC", sendAmount: 10 },
          { runner: async () => ({ txHash: VALID_TX }) },
        ),
    );
  });
});

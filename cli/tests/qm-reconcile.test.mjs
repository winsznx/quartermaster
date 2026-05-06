import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { appendEvent } from "../lib/qm/ledger.js";
import { findOrphans, resolutionHint, resolveOrphan } from "../lib/qm/reconcile.js";

const VALID_TX = "0x" + "a".repeat(64);
const VALID_TX2 = "0x" + "b".repeat(64);
const ISO = "2026-05-06T12:00:00Z";

const VALID_UUID_1 = "01926a3a-1234-7abc-8def-111111111111";
const VALID_UUID_2 = "01926a3a-1234-7abc-8def-222222222222";
const VALID_UUID_3 = "01926a3a-1234-7abc-8def-333333333333";

function makeAction(actionId, overrides = {}) {
  return {
    actionId,
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

let sandbox;
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "qm-reconcile-test-"));
  process.env.QM_HOME = sandbox;
});
afterEach(() => {
  delete process.env.QM_HOME;
  rmSync(sandbox, { recursive: true, force: true });
});

describe("reconcile.findOrphans", () => {
  it("returns [] when ledger is empty", async () => {
    const orphans = await findOrphans();
    assert.deepEqual(orphans, []);
  });

  it("returns [] when every action terminates", async () => {
    appendEvent({ type: "topup_planned", action: makeAction(VALID_UUID_1) });
    appendEvent({ type: "topup_send_pending", actionId: VALID_UUID_1, txHash: VALID_TX });
    appendEvent({ type: "topup_send_confirmed", actionId: VALID_UUID_1, txHash: VALID_TX });
    appendEvent({ type: "topup_confirmed", actionId: VALID_UUID_1, finalBalance: 10 });

    const orphans = await findOrphans();
    assert.deepEqual(orphans, []);
  });

  it("flags a planned-only action as orphan_planned", async () => {
    appendEvent({ type: "topup_planned", action: makeAction(VALID_UUID_1) });
    const orphans = await findOrphans();
    assert.equal(orphans.length, 1);
    assert.equal(orphans[0].state, "planned");
    assert.equal(orphans[0].actionId, VALID_UUID_1);
  });

  it("flags a swap-confirmed-but-no-send action as orphan_after_swap", async () => {
    appendEvent({ type: "topup_planned", action: makeAction(VALID_UUID_1) });
    appendEvent({ type: "topup_swap_pending", actionId: VALID_UUID_1, txHash: VALID_TX });
    appendEvent({ type: "topup_swap_confirmed", actionId: VALID_UUID_1, txHash: VALID_TX, gasUsed: 21000 });
    const orphans = await findOrphans();
    assert.equal(orphans.length, 1);
    assert.equal(orphans[0].state, "swap_confirmed");
    assert.equal(orphans[0].txHashes.swap, VALID_TX);
  });

  it("flags a send-pending-but-not-confirmed action as orphan_send_pending", async () => {
    appendEvent({ type: "topup_planned", action: makeAction(VALID_UUID_1) });
    appendEvent({ type: "topup_send_pending", actionId: VALID_UUID_1, txHash: VALID_TX });
    const orphans = await findOrphans();
    assert.equal(orphans.length, 1);
    assert.equal(orphans[0].state, "send_pending");
    assert.equal(orphans[0].txHashes.send, VALID_TX);
  });

  it("multiple orphans: one each at different stages", async () => {
    appendEvent({ type: "topup_planned", action: makeAction(VALID_UUID_1) });
    appendEvent({ type: "topup_planned", action: makeAction(VALID_UUID_2) });
    appendEvent({ type: "topup_swap_pending", actionId: VALID_UUID_2, txHash: VALID_TX });
    appendEvent({ type: "topup_planned", action: makeAction(VALID_UUID_3) });
    appendEvent({ type: "topup_send_confirmed", actionId: VALID_UUID_3, txHash: VALID_TX2 });
    appendEvent({ type: "topup_confirmed", actionId: VALID_UUID_3, finalBalance: 10 });

    const orphans = await findOrphans();
    assert.equal(orphans.length, 2);
    const states = orphans.map((o) => o.state).sort();
    assert.deepEqual(states, ["planned", "swap_pending"]);
  });

  it("blocked actions are not orphans", async () => {
    appendEvent({ type: "topup_planned", action: makeAction(VALID_UUID_1) });
    appendEvent({
      type: "topup_blocked",
      actionId: VALID_UUID_1,
      reasonCode: "CAP_EXCEEDED",
      reasonText: "over cap",
    });
    const orphans = await findOrphans();
    assert.deepEqual(orphans, []);
  });

  it("reconcile_resolved drops the orphan", async () => {
    appendEvent({ type: "topup_planned", action: makeAction(VALID_UUID_1) });
    let orphans = await findOrphans();
    assert.equal(orphans.length, 1);

    resolveOrphan(VALID_UUID_1, "marked_failed_after_chain_inspection");
    orphans = await findOrphans();
    assert.deepEqual(orphans, []);
  });
});

describe("reconcile.resolutionHint", () => {
  it("returns operator-friendly hint per state", () => {
    assert.match(resolutionHint("planned"), /safe to mark failed/);
    assert.match(resolutionHint("swap_confirmed"), /verify on-chain/);
    assert.match(resolutionHint("send_pending"), /verify finality/);
    assert.match(resolutionHint("bridge_pending"), /destination chain/);
  });
});

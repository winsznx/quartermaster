/**
 * Executor — drives a planned TopUpAction through the swap → bridge → send
 * pipeline by spawning upstream `npx zerion` subprocesses, capturing tx
 * hashes, and emitting one LedgerEvent per state transition (PRD §6.2).
 *
 * Why subprocess and not in-process import: upstream's commands print JSON
 * to stdout, exit on error, and may prompt for interactive input. Running
 * as a child process gives us the same surface a human gets, isolates
 * crashes, and never imports upstream code (Phase 1 contract).
 *
 * The runner accepts a `spawnImpl` injectable so tests can drive the state
 * machine deterministically without spawning real subprocesses. Production
 * uses the default `node:child_process.spawn`.
 */

import { spawn as nativeSpawn } from "node:child_process";

import { TopUpAction, TxHash } from "@quartermaster/shared-schemas";

import { appendEvent } from "./ledger.js";

const DEFAULT_TIMEOUT_MS = {
  swap: 90_000,
  bridge: 120_000,
  send: 60_000,
};

/**
 * Run an upstream `zerion` subprocess and return parsed JSON stdout.
 *
 * Conventions inherited from upstream (`cli/cli/lib/util/output.js`):
 * - Success: process exits 0, stdout is JSON.
 * - Failure: process exits 1, stdout is `{ "error": { code, message, ... } }`.
 *
 * Tests replace `spawnImpl` with a stub that returns a controlled
 * EventEmitter so the state machine can be exercised deterministically.
 * The default uses node:child_process.spawn — production path.
 */
function runZerion(args, { timeoutMs, spawnImpl = nativeSpawn } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl("npx", ["zerion", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = timeoutMs
      ? setTimeout(() => {
          child.kill("SIGKILL");
          reject(
            Object.assign(new Error(`zerion ${args.join(" ")}: timeout after ${timeoutMs}ms`), {
              code: "subprocess_timeout",
            }),
          );
        }, timeoutMs)
      : null;

    child.stdout?.on("data", (b) => (stdout += b.toString()));
    child.stderr?.on("data", (b) => (stderr += b.toString()));
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(Object.assign(err, { code: err.code || "subprocess_error" }));
    });
    child.on("close", (exitCode) => {
      if (timer) clearTimeout(timer);
      let parsed;
      try {
        parsed = stdout.trim().length ? JSON.parse(stdout) : null;
      } catch (err) {
        return reject(
          Object.assign(new Error(`zerion ${args.join(" ")}: non-JSON stdout (${err.message}); stderr=${stderr.slice(0, 200)}`), {
            code: "subprocess_parse",
            stdout,
            stderr,
          }),
        );
      }
      if (exitCode !== 0) {
        const errBody = parsed?.error ?? { code: "subprocess_exit", message: `exit ${exitCode}` };
        return reject(
          Object.assign(new Error(errBody.message), {
            code: errBody.code,
            stderr,
            exitCode,
          }),
        );
      }
      resolve(parsed);
    });
  });
}

function pickTxHash(parsed, key) {
  if (!parsed || typeof parsed !== "object") return null;
  // Try the obvious shapes; let zod's TxHash schema validate.
  const candidate =
    parsed[key] ??
    parsed.txHash ??
    parsed.transactionHash ??
    parsed.tx?.hash ??
    parsed.transaction?.hash;
  if (typeof candidate !== "string") return null;
  const result = TxHash.safeParse(candidate);
  return result.success ? result.data : null;
}

/**
 * Execute one planned TopUpAction. Returns the action mutated through state
 * transitions, with txHashes filled in. Emits LedgerEvents at every transition
 * (PRD §6.2):
 *
 *   topup_planned → swap_pending → swap_confirmed → bridge_pending →
 *   bridge_confirmed → send_pending → send_confirmed → topup_confirmed
 *
 * On error: emits `daemon_halt` or `topup_aborted_no_source` and rethrows.
 *
 * `options.runner` overrides the subprocess invoker (tests pass a stub
 * that returns scripted responses).
 * `options.requiresBridge` controls whether the bridge leg runs (selectedSource
 * on a different chain than target wallet).
 */
export async function executeAction(plannedAction, plan, options = {}) {
  const action = TopUpAction.parse(plannedAction);
  const runner = options.runner ?? runZerion;
  const requiresBridge = options.requiresBridge ?? false;
  const requiresSwap = options.requiresSwap ?? false;
  const timeouts = { ...DEFAULT_TIMEOUT_MS, ...(options.timeouts || {}) };

  // Per PRD §6.4 — actionId is written to the ledger BEFORE any tx so reconcile
  // can recover orphaned actions on next startup.
  appendEvent({ type: "topup_planned", action });

  const updated = { ...action, txHashes: { ...action.txHashes } };

  try {
    if (requiresSwap) {
      const swapResp = await runner(
        ["swap", plan.swapFrom, plan.swapTo, String(plan.swapAmount)],
        { timeoutMs: timeouts.swap, spawnImpl: options.spawnImpl },
      );
      const swapHash = pickTxHash(swapResp, "swap");
      if (!swapHash) throw Object.assign(new Error("swap returned no tx hash"), { code: "swap_no_hash" });
      updated.txHashes.swap = swapHash;
      updated.state = "swap_confirmed";
      appendEvent({ type: "topup_swap_pending", actionId: updated.actionId, txHash: swapHash });
      appendEvent({
        type: "topup_swap_confirmed",
        actionId: updated.actionId,
        txHash: swapHash,
        gasUsed: Number(swapResp.gasUsed ?? 0),
      });
    }

    if (requiresBridge) {
      const bridgeResp = await runner(
        ["bridge", plan.bridgeToken, plan.bridgeChain, String(plan.bridgeAmount)],
        { timeoutMs: timeouts.bridge, spawnImpl: options.spawnImpl },
      );
      const bridgeHash = pickTxHash(bridgeResp, "bridge");
      if (!bridgeHash) throw Object.assign(new Error("bridge returned no tx hash"), { code: "bridge_no_hash" });
      updated.txHashes.bridge = bridgeHash;
      updated.state = "bridge_confirmed";
      appendEvent({ type: "topup_bridge_pending", actionId: updated.actionId, txHash: bridgeHash });
      appendEvent({ type: "topup_bridge_confirmed", actionId: updated.actionId, txHash: bridgeHash });
    }

    const sendResp = await runner(
      ["send", plan.sendTo, plan.sendToken, String(plan.sendAmount)],
      { timeoutMs: timeouts.send, spawnImpl: options.spawnImpl },
    );
    const sendHash = pickTxHash(sendResp, "send");
    if (!sendHash) throw Object.assign(new Error("send returned no tx hash"), { code: "send_no_hash" });
    updated.txHashes.send = sendHash;
    appendEvent({ type: "topup_send_pending", actionId: updated.actionId, txHash: sendHash });
    appendEvent({ type: "topup_send_confirmed", actionId: updated.actionId, txHash: sendHash });

    updated.state = "confirmed";
    updated.confirmedAt = new Date().toISOString();
    appendEvent({
      type: "topup_confirmed",
      actionId: updated.actionId,
      finalBalance: Number(plan.expectedFinalBalance ?? updated.topUpAmountUsdc),
    });

    return updated;
  } catch (err) {
    updated.state = "error";
    updated.errorDetails = err.message;
    appendEvent({
      type: "daemon_halt",
      reason: `executor: action ${updated.actionId} failed at ${plannedAction.state}: ${err.message}`,
    });
    throw Object.assign(err, { partialAction: updated });
  }
}

export const __testing = { runZerion, pickTxHash };

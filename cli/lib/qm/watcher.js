/**
 * Watcher — observes subordinate balances each tick, derives BurnRateSample
 * via the EWMA helper, persists to samples.jsonl, emits LedgerEvents.
 *
 * In production the `portfolioFetcher` arg spawns `npx zerion analytics
 * portfolio <address> --json` and parses the USDC balance from the result.
 * Tests inject a mock fetcher.
 *
 * The watcher does NOT decide anything — it just emits the latest sample for
 * every fleet wallet plus an indication of whether each wallet's runway is
 * under threshold. The decider consumes this output.
 */

import {
  appendFileSync,
  createReadStream,
  mkdirSync,
  statSync,
} from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline";

import { BurnRateSample } from "@quartermaster/shared-schemas";

import { ewmaStep } from "./ewma.js";
import { qmPath } from "./storage.js";

const SAMPLES_PATH = () => qmPath("samples.jsonl");

/**
 * Read every sample for a wallet from samples.jsonl. Returns chronological
 * order (oldest first). Stream-reads to keep memory low.
 */
async function readSamplesFor(walletId) {
  const path = SAMPLES_PATH();
  let exists = true;
  try {
    statSync(path);
  } catch (err) {
    if (err && err.code === "ENOENT") exists = false;
    else throw err;
  }
  if (!exists) return [];

  const out = [];
  const rl = createInterface({
    input: createReadStream(path, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });
  for await (const raw of rl) {
    if (!raw) continue;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (parsed.walletId !== walletId) continue;
    const result = BurnRateSample.safeParse(parsed);
    if (result.success) out.push(result.data);
  }
  out.sort((a, b) => Date.parse(a.sampledAt) - Date.parse(b.sampledAt));
  return out;
}

function appendSample(sample) {
  const validated = BurnRateSample.parse(sample);
  const path = SAMPLES_PATH();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(validated)}\n`, { mode: 0o600 });
  return validated;
}

/**
 * Compute spend over the last hour from the previous sample's balance and
 * the current balance. Negative deltas (top-ups received from us!) are
 * floored to zero — we only care about outflow.
 */
function recentHourSpend(prevBalance, currentBalance) {
  const delta = prevBalance - currentBalance;
  return delta > 0 ? delta : 0;
}

/**
 * Sum spend over a sliding window. Reads back through samples in
 * chronological order and accumulates deltas. `windowMs = 24*60*60*1000`
 * for last24hSpend, etc.
 */
function rollingSpend(samples, latestBalance, latestAt, windowMs) {
  if (samples.length === 0) return 0;
  const cutoff = Date.parse(latestAt) - windowMs;
  let total = 0;
  let prevBalance = null;
  let prevAt = null;
  for (const s of samples) {
    if (prevBalance != null && Date.parse(s.sampledAt) >= cutoff) {
      total += recentHourSpend(prevBalance, s.usdcBalance);
    }
    prevBalance = s.usdcBalance;
    prevAt = s.sampledAt;
  }
  // Add the trailing leg from the last sample to the freshly-observed balance
  if (prevBalance != null && Date.parse(prevAt) >= cutoff) {
    total += recentHourSpend(prevBalance, latestBalance);
  }
  return total;
}

/**
 * Observe one wallet: fetch current balance, derive sample, persist, return.
 *
 *   wallet         SubordinateWallet (PRD §7)
 *   portfolioFetcher  async (address, chainId) => { usdcBalance: number }
 *   options.now    Date — defaults to new Date(); injectable for tests
 *   options.alpha  EWMA α — defaults to 0.30
 */
export async function observeWallet(wallet, portfolioFetcher, options = {}) {
  const now = options.now ?? new Date();
  const alpha = options.alpha ?? 0.30;

  const portfolio = await portfolioFetcher(wallet.address, wallet.chainId);
  if (!portfolio || typeof portfolio.usdcBalance !== "number") {
    throw new Error(
      `watcher: portfolioFetcher must return { usdcBalance: number }; got ${JSON.stringify(portfolio)}`,
    );
  }

  const history = await readSamplesFor(wallet.id);
  const prev = history[history.length - 1] ?? null;
  const prevBalance = prev?.usdcBalance ?? portfolio.usdcBalance;
  const prevEwma = prev?.ewmaHourlyBurn ?? 0;

  const recent = recentHourSpend(prevBalance, portfolio.usdcBalance);
  const ewmaHourlyBurn = ewmaStep(prevEwma, recent, alpha);

  // rollingSpend already accumulates the trailing leg (last persisted sample
  // → current balance), so do NOT add `recent` on top — that would double-
  // count the most recent hour.
  const last24hSpend = rollingSpend(
    history,
    portfolio.usdcBalance,
    now.toISOString(),
    24 * 60 * 60 * 1000,
  );
  const last7dSpend = rollingSpend(
    history,
    portfolio.usdcBalance,
    now.toISOString(),
    7 * 24 * 60 * 60 * 1000,
  );

  // No burn signal yet (cold start or genuinely-idle wallet) → set runway to
  // a large but finite value so `underThreshold` reads false. The schema
  // requires nonnegative; 1e9h ≈ 114k years, well past any sensible target.
  const runwayHours =
    ewmaHourlyBurn > 0 ? portfolio.usdcBalance / ewmaHourlyBurn : 1e9;

  const sample = {
    walletId: wallet.id,
    usdcBalance: portfolio.usdcBalance,
    sampledAt: now.toISOString(),
    last24hSpend,
    last7dSpend,
    ewmaHourlyBurn,
    runwayHours,
  };

  return appendSample(sample);
}

/**
 * Observe every wallet in the fleet. Returns the per-wallet sample plus a
 * synthetic flag indicating whether the wallet is under its `minRunwayHours`
 * threshold — the decider uses this to pick targets.
 *
 * Skips fetcher failures with a `failed` flag; daemon callers MUST emit a
 * `wallet_observed` event for every successful sample and skip the failures
 * (orchestrator-level concern, not the watcher's).
 */
export async function observeFleet(wallets, portfolioFetcher, options = {}) {
  const out = [];
  for (const wallet of wallets) {
    try {
      const sample = await observeWallet(wallet, portfolioFetcher, options);
      const underThreshold = sample.runwayHours < wallet.minRunwayHours;
      out.push({ wallet, sample, underThreshold, failed: false });
    } catch (err) {
      out.push({ wallet, sample: null, underThreshold: false, failed: true, error: err.message });
    }
  }
  return out;
}

export const __testing = { readSamplesFor, recentHourSpend, rollingSpend };

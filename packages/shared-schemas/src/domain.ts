import { z } from "zod";

import {
  Address,
  ChainId,
  IsoTimestamp,
  SourceId,
  TxHash,
  Uuid,
  WalletId,
} from "./primitives.ts";

/**
 * SubordinateWallet — PRD §7. The persisted shape in `~/.zerion/quartermaster/fleet.json`.
 */
export const SubordinateWallet = z
  .object({
    id: WalletId,
    address: Address,
    chainId: ChainId,
    targetRunwayHours: z.number().positive(),
    minRunwayHours: z.number().positive(),
    minUsdcBalance: z.number().nonnegative(),
    notes: z.string().optional(),
    createdAt: IsoTimestamp,
  })
  .strict();
export type SubordinateWallet = z.infer<typeof SubordinateWallet>;

/**
 * TreasurySource — PRD §7. The persisted shape in `~/.zerion/quartermaster/treasury.json`.
 *
 * `assetContract: "native"` indicates the chain's native asset (ETH on
 * eip155:1, SOL on solana:mainnet). Otherwise it is the ERC-20 contract.
 */
export const TreasurySource = z
  .object({
    id: SourceId,
    walletAddress: Address,
    chainId: ChainId,
    assetContract: z.union([Address, z.literal("native")]),
    symbol: z.string().min(1).max(16),
    currentApyEstimate: z.number().min(0),
    apyLastUpdated: IsoTimestamp,
    minRetainedBalance: z.number().nonnegative(),
    priority: z.number().int().nonnegative(),
  })
  .strict();
export type TreasurySource = z.infer<typeof TreasurySource>;

/**
 * BurnRateSample — PRD §7. Append-only record in `samples.jsonl`.
 *
 * `ewmaHourlyBurn` is the smoothed estimate per §8.3 (α = 0.30).
 * `runwayHours = currentBalance / ewmaHourlyBurn` (computed at sample time).
 */
export const BurnRateSample = z
  .object({
    walletId: WalletId,
    usdcBalance: z.number().nonnegative(),
    sampledAt: IsoTimestamp,
    last24hSpend: z.number().nonnegative(),
    last7dSpend: z.number().nonnegative(),
    ewmaHourlyBurn: z.number().nonnegative(),
    runwayHours: z.number().nonnegative(),
  })
  .strict();
export type BurnRateSample = z.infer<typeof BurnRateSample>;

/**
 * Per-policy evaluation result attached to a TopUpAction.
 */
export const PolicyCheck = z
  .object({
    policyName: z.string().min(1),
    passed: z.boolean(),
    reasonCode: z.string().optional(),
    reasonText: z.string().optional(),
    evaluatedAt: IsoTimestamp,
  })
  .strict();
export type PolicyCheck = z.infer<typeof PolicyCheck>;

/**
 * TopUpAction state machine — PRD §6.1 + §7.
 */
export const TopUpActionState = z.enum([
  "planned",
  "swap_pending",
  "swap_confirmed",
  "bridge_pending",
  "bridge_confirmed",
  "send_pending",
  "confirmed",
  "blocked",
  "partial",
  "error",
]);
export type TopUpActionState = z.infer<typeof TopUpActionState>;

/**
 * Per-action tx hashes. All optional — only the legs that actually execute fill in.
 */
export const TopUpTxHashes = z
  .object({
    swap: TxHash.optional(),
    bridge: TxHash.optional(),
    send: TxHash.optional(),
  })
  .strict();
export type TopUpTxHashes = z.infer<typeof TopUpTxHashes>;

/**
 * TopUpAction — PRD §7. Each action gets a UUIDv7 and accumulates state and
 * tx hashes as it progresses through the pipeline.
 */
export const TopUpAction = z
  .object({
    actionId: Uuid,
    targetWalletId: WalletId,
    topUpAmountUsdc: z.number().positive(),
    sourceId: SourceId,
    state: TopUpActionState,
    txHashes: TopUpTxHashes,
    policyChecks: z.array(PolicyCheck),
    reasonCodeFinal: z.string().optional(),
    createdAt: IsoTimestamp,
    confirmedAt: IsoTimestamp.optional(),
    errorDetails: z.string().optional(),
  })
  .strict();
export type TopUpAction = z.infer<typeof TopUpAction>;

/**
 * LedgerEvent — PRD §7. Discriminated union over `type`. Every line in
 * `ledger.jsonl` parses as exactly one of these.
 */
export const LedgerEvent = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("tick_started"),
      tickId: z.string().min(1),
      ts: IsoTimestamp,
    })
    .strict(),
  z
    .object({
      type: z.literal("tick_skipped_overlap"),
      ts: IsoTimestamp,
    })
    .strict(),
  z
    .object({
      type: z.literal("tick_completed"),
      tickId: z.string().min(1),
      durationMs: z.number().nonnegative(),
      ts: IsoTimestamp,
    })
    .strict(),
  z
    .object({
      type: z.literal("wallet_observed"),
      walletId: WalletId,
      sample: BurnRateSample,
    })
    .strict(),
  z
    .object({
      type: z.literal("topup_planned"),
      action: TopUpAction,
    })
    .strict(),
  z
    .object({
      type: z.literal("topup_blocked"),
      actionId: Uuid,
      reasonCode: z.string().min(1),
      reasonText: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("topup_swap_pending"),
      actionId: Uuid,
      txHash: TxHash,
    })
    .strict(),
  z
    .object({
      type: z.literal("topup_swap_confirmed"),
      actionId: Uuid,
      txHash: TxHash,
      gasUsed: z.number().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("topup_bridge_pending"),
      actionId: Uuid,
      txHash: TxHash,
    })
    .strict(),
  z
    .object({
      type: z.literal("topup_bridge_confirmed"),
      actionId: Uuid,
      txHash: TxHash,
    })
    .strict(),
  z
    .object({
      type: z.literal("topup_send_pending"),
      actionId: Uuid,
      txHash: TxHash,
    })
    .strict(),
  z
    .object({
      type: z.literal("topup_send_confirmed"),
      actionId: Uuid,
      txHash: TxHash,
    })
    .strict(),
  z
    .object({
      type: z.literal("topup_confirmed"),
      actionId: Uuid,
      finalBalance: z.number().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("topup_aborted_no_source"),
      actionId: Uuid,
    })
    .strict(),
  z
    .object({
      type: z.literal("daemon_halt"),
      reason: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("daemon_panic"),
      stack: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("agent_token_validated"),
      ts: IsoTimestamp,
    })
    .strict(),
  z
    .object({
      type: z.literal("reconcile_started"),
      sessionId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("reconcile_resolved"),
      actionId: Uuid,
      resolution: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("http_request"),
      ts: IsoTimestamp,
      method: z.string().min(1),
      path: z.string().min(1),
      status: z.number().int().nonnegative(),
      durationMs: z.number().nonnegative(),
      origin: z.string().nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("live_orchestrator_tick"),
      ts: IsoTimestamp,
      decision: z.enum([
        "skipped_no_burn_window",
        "skipped_low_subordinate_balance",
        "skipped_budget_exhausted",
        "skipped_passphrase_missing",
        "triggered_burn",
      ]),
      reason: z.string(),
      monthlyBudgetUsdc: z.number().nonnegative().optional(),
      monthlySpentUsdc: z.number().nonnegative().optional(),
      walletId: WalletId.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("daemon_started"),
      ts: IsoTimestamp,
      pid: z.number().int().positive(),
      port: z.number().int().positive(),
      hostname: z.string().min(1),
      qmHome: z.string().min(1),
      publicMode: z.boolean(),
      corsOrigins: z.array(z.string()),
    })
    .strict(),
]);
export type LedgerEvent = z.infer<typeof LedgerEvent>;

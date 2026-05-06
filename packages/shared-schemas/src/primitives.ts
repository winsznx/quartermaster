import { z } from "zod";

/**
 * EVM address — lowercase or checksummed 0x + 40 hex chars.
 */
export const Address = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "must be 0x-prefixed 40-char hex");
export type Address = z.infer<typeof Address>;

/**
 * Tx hash — 0x + 64 hex chars.
 */
export const TxHash = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "must be 0x-prefixed 64-char hex");
export type TxHash = z.infer<typeof TxHash>;

/**
 * CAIP-2 chain identifier — `eip155:<chain-id>` for EVM, `solana:<network>` for Solana.
 * PRD §7 example: `eip155:8453` (Base mainnet) / `eip155:84532` (Base Sepolia).
 */
export const ChainId = z
  .string()
  .regex(
    /^(eip155:\d+|solana:[A-Za-z0-9]+)$/,
    "must be CAIP-2 (e.g. eip155:8453 or solana:mainnet)"
  );
export type ChainId = z.infer<typeof ChainId>;

/**
 * Wallet identifier — user-chosen label. PRD §7: `[a-z0-9-]{2,32}`.
 */
export const WalletId = z
  .string()
  .regex(/^[a-z0-9-]{2,32}$/, "must be 2–32 chars of [a-z0-9-]");
export type WalletId = z.infer<typeof WalletId>;

/**
 * Treasury source identifier — same character class as WalletId.
 */
export const SourceId = z
  .string()
  .regex(/^[a-z0-9-]{2,32}$/, "must be 2–32 chars of [a-z0-9-]");
export type SourceId = z.infer<typeof SourceId>;

/**
 * UUID v7 — what TopUpAction.actionId uses. We accept any UUID format here
 * since v7 is shape-compatible with the standard UUID regex.
 */
export const Uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "must be a UUID"
  );
export type Uuid = z.infer<typeof Uuid>;

/**
 * ISO-8601 timestamp string. Validates by Date parsing — strings the daemon
 * emits via `new Date().toISOString()` always pass.
 */
export const IsoTimestamp = z.string().refine(
  (s) => !Number.isNaN(Date.parse(s)),
  "must be ISO-8601 parseable",
);
export type IsoTimestamp = z.infer<typeof IsoTimestamp>;

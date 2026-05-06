import { z } from "zod";

import {
  BurnRateSample,
  SubordinateWallet,
  TopUpAction,
  TreasurySource,
} from "./domain.ts";
import { IsoTimestamp, WalletId } from "./primitives.ts";

/**
 * `/api/health` — PRD §22.3. Probed by `daemon-status-pill` and `daemon-banner`
 * every 10s; the dashboard only checks `res.ok` today, but the shape is locked
 * for future use.
 */
export const HealthInfo = z
  .object({
    status: z.literal("ok"),
    daemonPid: z.number().int().positive(),
    startedAt: IsoTimestamp,
    version: z.string().min(1),
  })
  .strict();
export type HealthInfo = z.infer<typeof HealthInfo>;

/**
 * SubordinateWallet joined with its latest BurnRateSample fields, flattened
 * for dashboard convenience. The `/api/state` and `/api/fleet` endpoints emit
 * this shape so the FE can read `wallet.runwayHours` directly without a
 * second join client-side.
 *
 * Origin: dashboard fixture `state.json` invented this shape; it became the
 * reference for daemon emission per gap analysis 2026-05-06.
 */
export const WalletWithDerived = SubordinateWallet.extend({
  runwayHours: z.number().nonnegative(),
  usdcBalance: z.number().nonnegative(),
  ewmaHourlyBurn: z.number().nonnegative(),
});
export type WalletWithDerived = z.infer<typeof WalletWithDerived>;

/**
 * TreasurySource joined with its current on-chain balance — runtime / API
 * shape. The persisted `TreasurySource` (in `~/.zerion/quartermaster/treasury.json`)
 * is config-only per PRD §7. The watcher fetches the live balance per tick
 * and the daemon emits this enriched shape on `/api/state.treasury`,
 * `/api/treasury`, and as inputs to the layer-1 yield-curve-preservation
 * policy (PRD §8.4 line 1 needs `balance` to filter eligible sources).
 */
export const TreasurySourceWithBalance = TreasurySource.extend({
  balance: z.number().nonnegative(),
});
export type TreasurySourceWithBalance = z.infer<typeof TreasurySourceWithBalance>;

/**
 * Aggregate fleet/treasury KPIs surfaced on `/overview`. Server-derived;
 * not in PRD §7. Daemon computes from fleet + treasury + ledger query.
 */
export const Kpis = z
  .object({
    totalFleetBalance: z.number().nonnegative(),
    totalTreasuryBalance: z.number().nonnegative(),
    actions24h: z.number().int().nonnegative(),
  })
  .strict();
export type Kpis = z.infer<typeof Kpis>;

/**
 * Per-policy pass/fail counts. Server-derived from ledger scan.
 * Map keyed by policy name (e.g., "burn-rate-oracle", "max-per-action-cap").
 */
export const PolicyStats = z.record(
  z.string().min(1),
  z
    .object({
      pass: z.number().int().nonnegative(),
      fail: z.number().int().nonnegative(),
    })
    .strict(),
);
export type PolicyStats = z.infer<typeof PolicyStats>;

/**
 * `/api/state` — PRD §22.3, single round-trip aggregate for `/overview`.
 *
 * Composes: HealthInfo (top-level fields), fleet[] (joined), treasury[],
 * actions[] (truncated to N most recent), kpis, policyStats.
 *
 * The dashboard's `state.json` fixture is the canonical example of this
 * shape and the reason these fields live together in one response.
 */
export const StateResponse = HealthInfo.extend({
  fleet: z.array(WalletWithDerived),
  treasury: z.array(TreasurySourceWithBalance),
  actions: z.array(TopUpAction),
  kpis: Kpis,
  policyStats: PolicyStats,
});
export type StateResponse = z.infer<typeof StateResponse>;

/**
 * `/api/fleet` — single wallet array. Same per-wallet shape as `/api/state.fleet`.
 */
export const FleetResponse = z.array(WalletWithDerived);
export type FleetResponse = z.infer<typeof FleetResponse>;

/**
 * `/api/fleet/:id` — single wallet + recent samples for sparkline.
 */
export const FleetWalletDetailResponse = z
  .object({
    wallet: WalletWithDerived,
    samples: z.array(BurnRateSample),
  })
  .strict();
export type FleetWalletDetailResponse = z.infer<typeof FleetWalletDetailResponse>;

/**
 * `/api/treasury` — list of sources with current on-chain balance.
 */
export const TreasuryResponse = z.array(TreasurySourceWithBalance);
export type TreasuryResponse = z.infer<typeof TreasuryResponse>;

/**
 * `/api/actions` — paginated TopUpAction list.
 */
export const ActionsResponse = z
  .object({
    actions: z.array(TopUpAction),
    nextCursor: z.string().nullable(),
  })
  .strict();
export type ActionsResponse = z.infer<typeof ActionsResponse>;

/**
 * `/api/actions/:id` — full TopUpAction with its policyChecks intact.
 */
export const ActionDetailResponse = TopUpAction;
export type ActionDetailResponse = z.infer<typeof ActionDetailResponse>;

/**
 * Single policy entry for `/api/policies`.
 */
export const PolicyRegistryEntry = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    source: z.enum(["upstream", "quartermaster"]),
    stats: z
      .object({
        pass: z.number().int().nonnegative(),
        fail: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
export type PolicyRegistryEntry = z.infer<typeof PolicyRegistryEntry>;

/**
 * `/api/policies` — registry of all 8 policies (5 ours + 3 upstream).
 */
export const PoliciesResponse = z.array(PolicyRegistryEntry);
export type PoliciesResponse = z.infer<typeof PoliciesResponse>;

/**
 * Single policy evaluation record for the per-policy detail page.
 */
export const PolicyEvaluation = z
  .object({
    actionId: z.string(),
    walletId: WalletId,
    passed: z.boolean(),
    reasonCode: z.string().optional(),
    evaluatedAt: IsoTimestamp,
  })
  .strict();
export type PolicyEvaluation = z.infer<typeof PolicyEvaluation>;

/**
 * `/api/policies/:name` — config + recent evaluations.
 */
export const PolicyDetailResponse = z
  .object({
    entry: PolicyRegistryEntry,
    config: z.unknown(),
    evaluations: z.array(PolicyEvaluation),
  })
  .strict();
export type PolicyDetailResponse = z.infer<typeof PolicyDetailResponse>;

/**
 * `/api/settings` — daemon runtime config snapshot. Matches the orphan
 * `settings.json` fixture shape so the FE can wire it without refactor.
 */
export const SettingsResponse = z
  .object({
    daemon: z
      .object({
        version: z.string().min(1),
        pid: z.number().int().positive(),
        port: z.number().int().positive(),
        logLevel: z.enum(["debug", "info", "warn", "error"]),
      })
      .strict(),
    policyDefaults: z
      .object({
        maxPerActionUsdc: z.number().positive(),
        minCooldownMinutes: z.number().int().positive(),
        burnRateMultiplierThreshold: z.number().positive(),
      })
      .strict(),
    fleetThresholds: z
      .object({
        targetRunwayHours: z.number().positive(),
        minRunwayHours: z.number().positive(),
        minUsdcBalance: z.number().nonnegative(),
      })
      .strict(),
  })
  .strict();
export type SettingsResponse = z.infer<typeof SettingsResponse>;

/**
 * EVM chain registry — maps Zerion chain IDs to viem chain configs.
 */

import {
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  bsc,
  avalanche,
  gnosis,
  scroll,
  linea,
  zkSync,
  zora,
  blast,
} from "viem/chains";

// === BEGIN Quartermaster patch: base-sepolia ===
// Sanctioned upstream-touch per phase-1-7/integration. Adds Base Sepolia
// (eip155:84532) so the Quartermaster daemon + demo can run end-to-end on
// testnet. Mirrors `base`'s shape. Upstreamable to zerion-ai as a future
// contributor PR — see DEVIATIONS.md.
//
// IMPLEMENTATION NOTE: opt-in per process via env flag QM_ENABLE_BASE_SEPOLIA.
// Reason: upstream's tests/unit.test.mjs asserts CHAIN_IDS.size === 14. The
// Quartermaster daemon sets this flag when spawning npx zerion subprocesses
// (see cli/lib/qm/env.js + executor/portfolio-fetcher); upstream tests run
// without the flag so SUPPORTED_CHAINS stays 14. Test runs and operator-direct
// invocations see exactly upstream's behavior.
import { baseSepolia } from "viem/chains";

const QM_PATCH_ENABLED = process.env.QM_ENABLE_BASE_SEPOLIA === "1";

const QM_CHAIN_MAP_EXTENSIONS = QM_PATCH_ENABLED
  ? new Map([
      ["base-sepolia", { viemChain: baseSepolia, name: "Base Sepolia", nativeCurrency: "ETH" }],
    ])
  : new Map();
// === END Quartermaster patch ===

const CHAIN_MAP = new Map([
  ["ethereum", { viemChain: mainnet, name: "Ethereum", nativeCurrency: "ETH" }],
  ["base", { viemChain: base, name: "Base", nativeCurrency: "ETH" }],
  ["arbitrum", { viemChain: arbitrum, name: "Arbitrum", nativeCurrency: "ETH" }],
  ["optimism", { viemChain: optimism, name: "Optimism", nativeCurrency: "ETH" }],
  ["polygon", { viemChain: polygon, name: "Polygon", nativeCurrency: "POL" }],
  ["binance-smart-chain", { viemChain: bsc, name: "BNB Chain", nativeCurrency: "BNB" }],
  ["avalanche", { viemChain: avalanche, name: "Avalanche", nativeCurrency: "AVAX" }],
  ["gnosis", { viemChain: gnosis, name: "Gnosis", nativeCurrency: "xDAI" }],
  ["scroll", { viemChain: scroll, name: "Scroll", nativeCurrency: "ETH" }],
  ["linea", { viemChain: linea, name: "Linea", nativeCurrency: "ETH" }],
  ["zksync-era", { viemChain: zkSync, name: "zkSync Era", nativeCurrency: "ETH" }],
  ["zora", { viemChain: zora, name: "Zora", nativeCurrency: "ETH" }],
  ["blast", { viemChain: blast, name: "Blast", nativeCurrency: "ETH" }],
]);

// Solana (not in CHAIN_MAP since it uses different infra)
const SOLANA_CHAIN = {
  name: "Solana",
  nativeCurrency: "SOL",
  rpcUrl: "https://api.mainnet-beta.solana.com",
};

export const SUPPORTED_CHAINS = [
  ...CHAIN_MAP.keys(),
  "solana",
  // === BEGIN Quartermaster patch: base-sepolia ===
  ...QM_CHAIN_MAP_EXTENSIONS.keys(),
  // === END Quartermaster patch ===
];

// CAIP-2 identifiers derived from viem chain IDs — single source of truth
export const CAIP2_MAP = new Map([
  ...Array.from(CHAIN_MAP.entries()).map(([name, info]) => [name, `eip155:${info.viemChain.id}`]),
  ["solana", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
  // === BEGIN Quartermaster patch: base-sepolia ===
  ...Array.from(QM_CHAIN_MAP_EXTENSIONS.entries()).map(([name, info]) => [name, `eip155:${info.viemChain.id}`]),
  // === END Quartermaster patch ===
]);

const CAIP2_REVERSE = new Map([...CAIP2_MAP.entries()].map(([k, v]) => [v, k]));

export function toCaip2(chainName) {
  return CAIP2_MAP.get(chainName) || chainName;
}

export function fromCaip2(caip2) {
  return CAIP2_REVERSE.get(caip2) || caip2;
}

export function isSolana(chainId) {
  return chainId === "solana";
}

export function getSolanaRpcUrl() {
  return process.env.SOLANA_RPC_URL || SOLANA_CHAIN.rpcUrl;
}

export function getChain(zerionId) {
  if (zerionId === "solana") return SOLANA_CHAIN;
  // === BEGIN Quartermaster patch: base-sepolia ===
  return CHAIN_MAP.get(zerionId) || QM_CHAIN_MAP_EXTENSIONS.get(zerionId) || null;
  // === END Quartermaster patch ===
}

export function getViemChain(zerionId) {
  // === BEGIN Quartermaster patch: base-sepolia ===
  const chain = CHAIN_MAP.get(zerionId) || QM_CHAIN_MAP_EXTENSIONS.get(zerionId);
  // === END Quartermaster patch ===
  return chain ? chain.viemChain : null;
}


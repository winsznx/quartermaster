/**
 * `zerion treasury add <id> <wallet-address> <symbol> [--chain <name>]
 *                     [--asset <0x|native>] [--apy <pct>]
 *                     [--min-retained <usd>] [--priority <int>]`
 *
 * NOT an upstream command. Phase 2 deliverable per PRD §31.3.
 */

import { print, printError } from "../../cli/lib/util/output.js";
import { toCaip2 } from "../../cli/lib/chain/registry.js";

import { addSource } from "../../lib/treasury/sources.js";

const CAIP2_REGEX = /^(eip155:\d+|solana:[A-Za-z0-9]+)$/;

function resolveChain(input) {
  if (!input) return "eip155:8453";
  if (CAIP2_REGEX.test(input)) return input;
  const caip2 = toCaip2(input);
  if (!caip2) {
    throw Object.assign(new Error(`unknown chain "${input}"`), {
      code: "unknown_chain",
    });
  }
  return caip2;
}

export default async function treasuryAdd(args, flags) {
  const [id, walletAddress, symbol] = args;
  if (!id || !walletAddress || !symbol) {
    printError(
      "missing_args",
      "Usage: zerion treasury add <id> <wallet-address> <symbol> [--chain <name>] [--asset <0x|native>] [--apy <pct>] [--min-retained <usd>] [--priority <int>]",
    );
    process.exit(1);
  }

  try {
    const chainId = resolveChain(flags.chain);

    const source = addSource({
      id,
      walletAddress,
      chainId,
      assetContract: flags.asset ?? "native",
      symbol,
      currentApyEstimate: Number(flags.apy ?? 0),
      apyLastUpdated: new Date().toISOString(),
      minRetainedBalance: Number(flags["min-retained"] ?? 0),
      priority: Number.parseInt(flags.priority ?? 0, 10),
    });

    print({ source, registered: true });
  } catch (err) {
    if (err && typeof err === "object" && "issues" in err) {
      printError("invalid_input", err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    } else {
      printError(err.code || "treasury_add_failed", err.message);
    }
    process.exit(1);
  }
}

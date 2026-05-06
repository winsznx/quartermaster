/**
 * `zerion fleet add <id> <address> [--chain <name>] [--target-runway <h>]
 *                                  [--min-runway <h>] [--min-balance <usdc>]
 *                                  [--notes <text>]`
 *
 * NOT an upstream command. Phase 2 deliverable per PRD §31.3.
 */

import { print, printError } from "../../cli/lib/util/output.js";
import { toCaip2 } from "../../cli/lib/chain/registry.js";

import { addWallet } from "../../lib/fleet/registry.js";

const CAIP2_REGEX = /^(eip155:\d+|solana:[A-Za-z0-9]+)$/;

function resolveChain(input) {
  if (!input) return "eip155:8453"; // PRD §7 default — Base mainnet
  if (CAIP2_REGEX.test(input)) return input;
  const caip2 = toCaip2(input);
  if (!caip2) {
    throw Object.assign(new Error(`unknown chain "${input}"`), {
      code: "unknown_chain",
    });
  }
  return caip2;
}

export default async function fleetAdd(args, flags) {
  const [id, address] = args;
  if (!id || !address) {
    printError("missing_args", "Usage: zerion fleet add <id> <address> [--chain <name>] [--target-runway <h>] [--min-runway <h>] [--min-balance <usdc>]");
    process.exit(1);
  }

  try {
    const chainId = resolveChain(flags.chain);

    const wallet = addWallet({
      id,
      address,
      chainId,
      targetRunwayHours: Number(flags["target-runway"] ?? 72),
      minRunwayHours: Number(flags["min-runway"] ?? 24),
      minUsdcBalance: Number(flags["min-balance"] ?? 5),
      notes: flags.notes,
      createdAt: new Date().toISOString(),
    });

    print({ wallet, registered: true });
  } catch (err) {
    if (err && typeof err === "object" && "issues" in err) {
      printError("invalid_input", err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    } else {
      printError(err.code || "fleet_add_failed", err.message);
    }
    process.exit(1);
  }
}

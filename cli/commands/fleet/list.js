/**
 * `zerion fleet list [--chain <name>]`
 *
 * NOT an upstream command. Phase 2 deliverable per PRD §31.3.
 */

import { print, printError } from "../../cli/lib/util/output.js";

import { listWallets } from "../../lib/fleet/registry.js";

export default async function fleetList(_args, flags) {
  try {
    const wallets = listWallets({ chainId: flags.chain });
    print({ wallets, count: wallets.length });
  } catch (err) {
    printError(err.code || "fleet_list_failed", err.message);
    process.exit(1);
  }
}

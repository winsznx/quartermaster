/**
 * `zerion fleet status [--id <wallet-id>]`
 *
 * Shows configured wallets and the static thresholds we know about. Live
 * runway / burn-rate fields land in Phase 4 once the daemon is sampling;
 * for now this command just prints the configuration so operators can
 * verify their fleet was registered correctly.
 *
 * NOT an upstream command. Phase 2 deliverable per PRD §31.3.
 */

import { print, printError } from "../../cli/lib/util/output.js";

import { getWallet, listWallets } from "../../lib/fleet/registry.js";

export default async function fleetStatus(_args, flags) {
  try {
    if (flags.id) {
      const wallet = getWallet(flags.id);
      if (!wallet) {
        printError("not_found", `wallet "${flags.id}" not in fleet`);
        process.exit(1);
      }
      print({ wallet, live: null, hint: "Live runway / burn-rate fields populate when the daemon is running (Phase 4)." });
      return;
    }

    const wallets = listWallets();
    print({
      wallets,
      count: wallets.length,
      live: null,
      hint: "Live runway / burn-rate fields populate when the daemon is running (Phase 4).",
    });
  } catch (err) {
    printError(err.code || "fleet_status_failed", err.message);
    process.exit(1);
  }
}

/**
 * `zerion fleet remove <id>`
 *
 * NOT an upstream command. Phase 2 deliverable per PRD §31.3.
 */

import { print, printError } from "../../cli/lib/util/output.js";

import { removeWallet } from "../../lib/fleet/registry.js";

export default async function fleetRemove(args, _flags) {
  const [id] = args;
  if (!id) {
    printError("missing_args", "Usage: zerion fleet remove <id>");
    process.exit(1);
  }

  try {
    const removed = removeWallet(id);
    if (!removed) {
      printError("not_found", `wallet "${id}" not in fleet`);
      process.exit(1);
    }
    print({ removed: true, id });
  } catch (err) {
    printError(err.code || "fleet_remove_failed", err.message);
    process.exit(1);
  }
}

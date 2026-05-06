/**
 * `zerion treasury list`
 *
 * NOT an upstream command. Phase 2 deliverable per PRD §31.3.
 */

import { print, printError } from "../../cli/lib/util/output.js";

import { listSources } from "../../lib/treasury/sources.js";

export default async function treasuryList(_args, _flags) {
  try {
    const sources = listSources();
    print({ sources, count: sources.length });
  } catch (err) {
    printError(err.code || "treasury_list_failed", err.message);
    process.exit(1);
  }
}

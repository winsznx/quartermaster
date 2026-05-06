/**
 * `zerion qm reconcile [<id>] [--mark-failed]`
 *
 * Without args: lists every orphan with state + resolution hint.
 * With <id> + --mark-failed: writes a reconcile_resolved event marking the
 * action as operator-resolved-failed. The operator is responsible for
 * verifying chain state before invoking this.
 *
 * NOT an upstream command. Phase 4 deliverable per PRD §31.5.
 */

import { print, printError } from "../../cli/lib/util/output.js";

import { findOrphans, resolutionHint, resolveOrphan } from "../../lib/qm/reconcile.js";

export default async function qmReconcile(args, flags) {
  try {
    const orphans = await findOrphans();
    if (args.length === 0) {
      const enriched = orphans.map((o) => ({ ...o, hint: resolutionHint(o.state) }));
      print({ orphans: enriched, count: enriched.length });
      return;
    }

    const [id] = args;
    const target = orphans.find((o) => o.actionId === id);
    if (!target) {
      printError("not_found", `no orphan with actionId "${id}"`);
      process.exit(1);
    }

    if (!flags["mark-failed"]) {
      printError(
        "missing_disposition",
        "specify --mark-failed to mark this action resolved (operator must verify chain state first)",
        { hint: resolutionHint(target.state) },
      );
      process.exit(1);
    }

    resolveOrphan(id, "operator_marked_failed");
    print({ resolved: true, actionId: id });
  } catch (err) {
    printError(err.code || "reconcile_failed", err.message);
    process.exit(1);
  }
}

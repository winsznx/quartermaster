/**
 * `zerion qm run` — start the daemon. Acquires lock, hydrates state, binds
 * HTTP server to 127.0.0.1:7402, runs tick loop until SIGINT/SIGTERM.
 *
 * Phase 4 implementation: command starts the long-running daemon process.
 * For now we keep this command minimal — the integration test exercises
 * `runOneTick` directly. The interactive long-running path is the
 * production code path; tests don't exercise it.
 */

import { print, printError } from "../../cli/lib/util/output.js";

import {
  acquireLock,
  hydrateState,
  releaseLock,
  runOneTick,
} from "../../lib/qm/daemon.js";
import { mergeIntoProcessEnv } from "../../lib/qm/env.js";
import { appendEvent } from "../../lib/qm/ledger.js";
import { findOrphans } from "../../lib/qm/reconcile.js";
import { buildApp } from "../../lib/qm/http-server.js";

export default async function qmRun(_args, flags) {
  // Load .env.local into process.env so this process (read paths, error
  // formatters, etc.) sees the API key. Subprocess spawn sites
  // independently call buildSubprocessEnv to ensure children get it too.
  const { path, added } = mergeIntoProcessEnv();
  if (path) print({ envLoaded: { path, keys: added } });

  if (!acquireLock()) {
    printError(
      "lock_held",
      "Another daemon is already running (lock file exists at ~/.zerion/quartermaster/.lock). " +
        "Stop it or remove the lock if stale.",
    );
    process.exit(1);
  }

  try {
    const orphans = await findOrphans();
    if (orphans.length > 0) {
      printError(
        "orphans_present",
        `${orphans.length} incomplete action(s) need reconciliation. Run "zerion qm reconcile <id>" for each, then re-run.`,
        { orphans },
      );
      releaseLock();
      process.exit(1);
    }

    const tickSeconds = Number(flags["tick-seconds"] ?? 60);
    const port = Number(flags.port ?? 7402);

    const state = await hydrateState();
    const app = buildApp(state);

    // Bind HTTP server (loopback only).
    const { serve } = await import("@hono/node-server");
    const server = serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
    print({ daemonStarted: true, pid: process.pid, port, tickSeconds });

    let stopping = false;
    let consecutiveOverlaps = 0;
    let inFlight = false;

    async function tick() {
      if (inFlight) {
        consecutiveOverlaps += 1;
        appendEvent({ type: "tick_skipped_overlap", ts: new Date().toISOString() });
        if (consecutiveOverlaps >= 3) {
          // Auto-throttle per PRD §6.5
          appendEvent({
            type: "daemon_halt",
            reason: `auto-throttle: ${consecutiveOverlaps} consecutive overlapping ticks`,
          });
          await shutdown();
        }
        return;
      }
      inFlight = true;
      consecutiveOverlaps = 0;
      try {
        await runOneTick(state);
      } catch (err) {
        appendEvent({ type: "daemon_panic", stack: err.stack ?? err.message });
      } finally {
        inFlight = false;
      }
    }

    const interval = setInterval(tick, tickSeconds * 1000);
    tick(); // immediate first tick

    async function shutdown() {
      if (stopping) return;
      stopping = true;
      clearInterval(interval);
      // Give an in-flight tick up to 3s to drain.
      const start = Date.now();
      while (inFlight && Date.now() - start < 3000) {
        await new Promise((r) => setTimeout(r, 100));
      }
      await server.close?.();
      releaseLock();
      process.exit(0);
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    process.on("SIGHUP", () => {
      // Phase 4 SIGHUP: re-hydrate state without restarting the loop.
      hydrateState()
        .then((next) => Object.assign(state, next))
        .catch((err) => appendEvent({ type: "daemon_panic", stack: err.stack ?? err.message }));
    });
    process.on("uncaughtException", (err) => {
      appendEvent({ type: "daemon_panic", stack: err.stack ?? err.message });
      shutdown();
    });
  } catch (err) {
    releaseLock();
    printError("daemon_start_failed", err.message);
    process.exit(1);
  }
}

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
import { buildApp, resolveBindConfig } from "../../lib/qm/http-server.js";
import { resolveQmHome } from "../../lib/qm/storage.js";

export default async function qmRun(_args, flags) {
  // Load .env.local into process.env so this process (read paths, error
  // formatters, etc.) sees the API key. Subprocess spawn sites
  // independently call buildSubprocessEnv to ensure children get it too.
  const { path, added } = mergeIntoProcessEnv();
  if (path) print({ envLoaded: { path, keys: added } });

  // Phase 8: log volume choice at startup so operators can verify the
  // daemon is reading from /data/quartermaster on Railway, ~/.zerion/...
  // locally, or QM_HOME if explicitly set.
  const { root: qmHome, source: qmHomeSource } = resolveQmHome();
  print({ qmHome: { root: qmHome, source: qmHomeSource } });

  if (!acquireLock()) {
    printError(
      "lock_held",
      `Another daemon is already running (lock file exists at ${qmHome}/.lock). ` +
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
    const bindConfig = resolveBindConfig();
    const port = flags.port != null ? Number(flags.port) : bindConfig.port;
    const hostname = flags.hostname ?? bindConfig.hostname;

    const state = await hydrateState({ publicMode: bindConfig.publicMode });
    const app = buildApp(state, { corsOrigins: bindConfig.corsOrigins });

    // Bind HTTP server. 127.0.0.1 by default; 0.0.0.0 under QM_PUBLIC=1
    // (Railway / public-deploy mode).
    const { serve } = await import("@hono/node-server");
    const server = serve({ fetch: app.fetch, port, hostname });
    appendEvent({
      type: "daemon_started",
      ts: new Date().toISOString(),
      pid: process.pid,
      port,
      hostname,
      qmHome,
      publicMode: bindConfig.publicMode,
      corsOrigins: bindConfig.corsOrigins,
    });
    print({
      daemonStarted: true,
      pid: process.pid,
      port,
      hostname,
      tickSeconds,
      publicMode: bindConfig.publicMode,
      corsOrigins: bindConfig.corsOrigins,
    });

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

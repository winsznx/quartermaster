"use client";

/**
 * Shared offline-state panel rendered by every route when the daemon is
 * unreachable. Surfaces the start command + a link to the operator
 * bootstrap guide for visitors who land on the deployed dashboard without
 * a running local daemon.
 */
export function DaemonOfflinePanel({ error }: { error?: string }) {
  return (
    <div className="border border-border-subtle rounded-[6px] bg-surface-1 p-6">
      <p className="font-medium text-text-primary">This dashboard requires a local Quartermaster daemon.</p>
      <p className="text-sm text-text-secondary mt-2 mb-4">
        The daemon runs on your machine — it holds your signing key and watches the fleet. The
        dashboard polls it at <code className="font-mono text-accent">http://127.0.0.1:7402</code>.
        Setup takes about 10 minutes.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <a
          href="https://github.com/winsznx/quartermaster/blob/main/cli/BOOTSTRAP.md"
          className="bg-accent text-text-inverse px-5 py-2 rounded-[6px] font-medium hover:bg-accent-hover transition-colors duration-150 text-sm inline-block"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open BOOTSTRAP guide →
        </a>
        <span className="text-xs text-text-muted">
          Already set up? Run{" "}
          <code className="font-mono text-accent">zerion qm run</code> in your terminal.
        </span>
      </div>

      {error && <p className="text-[11px] text-text-muted mt-4 font-mono">{error}</p>}
    </div>
  );
}

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
      <p className="font-medium text-text-primary">Daemon offline.</p>
      <p className="text-sm text-text-secondary mt-2 mb-3">
        The Quartermaster daemon runs locally — it holds the principal&apos;s signing key and
        watches the fleet on your machine. The dashboard polls it at{" "}
        <code className="font-mono text-accent">http://127.0.0.1:7402</code>.
      </p>
      <p className="text-sm text-text-secondary mb-3">Start it with:</p>
      <code className="inline-block bg-surface-2 text-accent px-3 py-1.5 rounded font-mono text-sm">
        zerion qm run
      </code>
      <p className="text-xs text-text-muted mt-4">
        Haven&apos;t set up the keystore yet?{" "}
        <a
          href="https://github.com/winsznx/quartermaster/blob/main/cli/BOOTSTRAP.md"
          className="text-accent hover:text-accent-hover underline transition-colors duration-150"
          target="_blank"
          rel="noopener noreferrer"
        >
          See cli/BOOTSTRAP.md
        </a>{" "}
        for the operator setup steps.
      </p>
      {error && <p className="text-[11px] text-text-muted mt-3 font-mono">{error}</p>}
    </div>
  );
}

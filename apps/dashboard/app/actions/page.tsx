"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { daemonClient } from "@/lib/daemon-client";
import { usePolledDaemon } from "@/lib/use-daemon";

export default function ActionsPage() {
  const view = usePolledDaemon(() => daemonClient.actions(100), 5_000);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-medium text-text-primary tracking-tight">Actions</h1>
        <p className="text-sm text-text-secondary mt-1">Top-up ledger. Every action logged.</p>
      </div>

      {view.status === "loading" && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {view.status === "offline" && <DaemonOffline error={view.error} />}
      {(view.status === "drift" || view.status === "error") && <ErrorBanner error={view.error} />}

      {view.status === "ok" && (
        <div className="bg-surface-1 border border-border-subtle rounded-[6px] shadow-sm overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-2 text-text-secondary text-xs font-medium uppercase tracking-wider">
                  <th className="px-6 py-3 font-medium">Time</th>
                  <th className="px-6 py-3 font-medium">Wallet</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Source</th>
                  <th className="px-6 py-3 font-medium">State</th>
                  <th className="px-6 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {view.data.actions
                  .filter((a) => !a.actionId.startsWith("00000000-0000-"))
                  .map((action) => {
                    const variant: "default" | "destructive" | "success" | "warning" =
                      action.state === "confirmed"
                        ? "success"
                        : action.state === "blocked" || action.state === "error"
                          ? "destructive"
                          : action.state === "partial"
                            ? "warning"
                            : "default";
                    const time = new Date(action.createdAt).toLocaleString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      month: "short",
                      day: "numeric",
                    });
                    return (
                      <tr key={action.actionId} className="hover:bg-surface-2/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary font-mono">
                          {time}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">
                          <Link
                            href={`/actions/${action.actionId}`}
                            className="hover:text-accent transition-colors"
                          >
                            {action.targetWalletId}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-text-primary">
                          {action.topUpAmountUsdc.toFixed(2)} USDC
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                          {action.sourceId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Badge variant={variant}>{action.state}</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-text-muted">
                          {action.reasonCodeFinal ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                {view.data.actions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-text-muted">
                      No actions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DaemonOffline({ error }: { error: string }) {
  return (
    <div className="border border-border-subtle rounded-[6px] bg-surface-1 p-6">
      <p className="font-medium text-text-primary">Daemon offline.</p>
      <p className="text-sm text-text-secondary mt-2 mb-3">Start it with:</p>
      <code className="inline-block bg-surface-2 text-accent px-3 py-1.5 rounded font-mono text-sm">
        zerion qm run
      </code>
      <p className="text-[11px] text-text-muted mt-3 font-mono">{error}</p>
    </div>
  );
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="border border-warning/40 bg-warning/5 rounded-[6px] p-6">
      <p className="font-medium text-warning">Daemon response error.</p>
      <p className="text-[11px] text-text-muted mt-3 font-mono">{error}</p>
    </div>
  );
}

"use client";

import { Landmark } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { daemonClient } from "@/lib/daemon-client";
import { usePolledDaemon } from "@/lib/use-daemon";

export default function TreasuryPage() {
  const view = usePolledDaemon(() => daemonClient.treasury(), 10_000);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-medium text-text-primary tracking-tight">Treasury</h1>
        <p className="text-sm text-text-secondary mt-1">
          Yield-bearing positions that fund top-ups.
        </p>
      </div>

      {view.status === "loading" && <Skeleton className="h-48 w-full" />}

      {view.status === "offline" && (
        <div className="border border-border-subtle rounded-[6px] bg-surface-1 p-6">
          <p className="font-medium text-text-primary">Daemon offline.</p>
          <code className="inline-block bg-surface-2 text-accent px-3 py-1.5 rounded font-mono text-sm mt-3">
            zerion qm run
          </code>
        </div>
      )}

      {(view.status === "error" || view.status === "drift") && (
        <div className="border border-warning/40 bg-warning/5 rounded-[6px] p-6">
          <p className="font-medium text-warning">{view.error}</p>
        </div>
      )}

      {view.status === "ok" && view.data.length === 0 && (
        <div className="border border-dashed border-border-subtle rounded-[6px] p-12 text-center">
          <Landmark size={32} className="text-text-muted mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-text-secondary mb-3">No sources registered.</p>
          <code className="inline-block bg-surface-2 text-accent px-3 py-1.5 rounded font-mono text-xs">
            zerion treasury add &lt;id&gt; &lt;address&gt; &lt;symbol&gt;
          </code>
        </div>
      )}

      {view.status === "ok" && view.data.length > 0 && (
        <div className="bg-surface-1 border border-border-subtle rounded-[6px] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-2 text-text-secondary text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-medium">Source</th>
                <th className="px-6 py-3 font-medium">Symbol</th>
                <th className="px-6 py-3 font-medium">Chain</th>
                <th className="px-6 py-3 font-medium">Balance</th>
                <th className="px-6 py-3 font-medium">APY</th>
                <th className="px-6 py-3 font-medium">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {view.data
                .slice()
                .sort((a, b) => a.currentApyEstimate - b.currentApyEstimate)
                .map((s) => (
                  <tr key={s.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">{s.id}</td>
                    <td className="px-6 py-4 text-sm font-mono text-text-secondary">{s.symbol}</td>
                    <td className="px-6 py-4 text-xs font-mono text-text-muted">{s.chainId}</td>
                    <td className="px-6 py-4 text-sm font-mono text-text-primary">{s.balance.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-mono text-text-secondary">
                      {(s.currentApyEstimate * 100).toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-text-secondary">{s.priority}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

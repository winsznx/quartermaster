"use client";

import Link from "next/link";
import { Bot } from "lucide-react";

import { DaemonOfflinePanel } from "@/components/daemon-offline-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { daemonClient } from "@/lib/daemon-client";
import { usePolledDaemon } from "@/lib/use-daemon";

export default function FleetPage() {
  const view = usePolledDaemon(() => daemonClient.fleet(), 5_000);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-medium text-text-primary tracking-tight">Fleet</h1>
        <p className="text-sm text-text-secondary mt-1">
          Subordinate agent wallets and their runway.
        </p>
      </div>

      {view.status === "loading" && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {view.status === "offline" && <DaemonOfflinePanel error={view.error} />}
      {(view.status === "error" || view.status === "drift") && (
        <div className="border border-warning/40 bg-warning/5 rounded-[6px] p-6">
          <p className="font-medium text-warning">{view.error}</p>
        </div>
      )}

      {view.status === "ok" && view.data.length === 0 && (
        <div className="border border-dashed border-border-subtle rounded-[6px] p-12 text-center">
          <Bot size={32} className="text-text-muted mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-text-secondary mb-3">No wallets registered.</p>
          <code className="inline-block bg-surface-2 text-accent px-3 py-1.5 rounded font-mono text-xs">
            zerion fleet add &lt;wallet-id&gt; &lt;address&gt;
          </code>
        </div>
      )}

      {view.status === "ok" && view.data.length > 0 && (
        <div className="space-y-3">
          {view.data.map((w) => {
            const runwayColor =
              w.runwayHours < 24
                ? "text-danger"
                : w.runwayHours < 72
                  ? "text-warning"
                  : "text-success";
            const display = w.runwayHours < 1e6 ? `${w.runwayHours.toFixed(0)}h` : "∞";
            return (
              <Link
                key={w.id}
                href={`/fleet/${w.id}`}
                className="block bg-surface-1 border border-border-subtle rounded-[6px] p-5 hover:border-border-strong transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-medium text-text-primary">{w.id}</div>
                    <div className="text-xs font-mono text-text-muted mt-1 truncate max-w-md">
                      {w.address}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wider text-text-muted">Balance</div>
                      <div className="font-mono text-text-primary">{w.usdcBalance.toFixed(2)} USDC</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wider text-text-muted">Runway</div>
                      <div className={`font-mono ${runwayColor}`}>{display}</div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}


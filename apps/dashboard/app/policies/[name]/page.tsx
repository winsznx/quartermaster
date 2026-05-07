"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

import { DaemonOfflinePanel } from "@/components/daemon-offline-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { daemonClient } from "@/lib/daemon-client";
import { usePolledDaemon } from "@/lib/use-daemon";

interface PageProps {
  params: Promise<{ name: string }>;
}

export default function PolicyDetailPage({ params }: PageProps) {
  const { name } = use(params);
  const view = usePolledDaemon(() => daemonClient.policy(name), 10_000, name);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/policies" className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors w-fit">
        <ArrowLeft className="h-4 w-4" /> Back to Policies
      </Link>

      <div>
        <h1 className="text-[28px] font-medium text-text-primary tracking-tight font-mono">{name}</h1>
      </div>

      {view.status === "loading" && <Skeleton className="h-72 w-full" />}

      {view.status === "offline" && <DaemonOfflinePanel error={view.error} />}

      {(view.status === "error" || view.status === "drift") && (
        <div className="border border-warning/40 bg-warning/5 rounded-[6px] p-6">
          <p className="font-medium text-warning">{view.error}</p>
        </div>
      )}

      {view.status === "ok" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-4">
              <div className="text-[11px] uppercase tracking-wider text-text-muted">Version</div>
              <div className="font-mono text-sm text-text-primary mt-1">v{view.data.entry.version}</div>
            </div>
            <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-4">
              <div className="text-[11px] uppercase tracking-wider text-text-muted">Pass</div>
              <div className="font-mono text-sm text-success mt-1">{view.data.entry.stats.pass}</div>
            </div>
            <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-4">
              <div className="text-[11px] uppercase tracking-wider text-text-muted">Fail</div>
              <div className={`font-mono text-sm mt-1 ${view.data.entry.stats.fail > 0 ? "text-danger" : "text-text-muted"}`}>
                {view.data.entry.stats.fail}
              </div>
            </div>
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-5">
            <div className="text-xs uppercase tracking-wider text-text-muted mb-3">Config</div>
            <pre className="font-mono text-xs text-text-secondary overflow-auto">
{JSON.stringify(view.data.config ?? {}, null, 2)}
            </pre>
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-5">
            <div className="text-xs uppercase tracking-wider text-text-muted mb-3">Recent evaluations</div>
            {view.data.evaluations.length === 0 ? (
              <p className="text-sm text-text-muted">No evaluations recorded.</p>
            ) : (
              <div className="space-y-1 font-mono text-xs">
                {view.data.evaluations.slice(-50).reverse().map((e, i) => (
                  <div key={i} className="flex items-center gap-3 py-1 border-b border-border-subtle">
                    {e.passed ? (
                      <CheckCircle2 size={14} className="text-success shrink-0" />
                    ) : (
                      <XCircle size={14} className="text-danger shrink-0" />
                    )}
                    <span className="text-text-secondary">{new Date(e.evaluatedAt).toLocaleString()}</span>
                    <span className="text-text-muted">{e.walletId}</span>
                    {e.reasonCode && <span className="text-danger">{e.reasonCode}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

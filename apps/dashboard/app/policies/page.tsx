"use client";

import Link from "next/link";
import { Shield } from "lucide-react";

import { DaemonOfflinePanel } from "@/components/daemon-offline-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { daemonClient } from "@/lib/daemon-client";
import { usePolledDaemon } from "@/lib/use-daemon";

export default function PoliciesPage() {
  const view = usePolledDaemon(() => daemonClient.policies(), 10_000);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-medium text-text-primary tracking-tight">Policies</h1>
        <p className="text-sm text-text-secondary mt-1">
          Five composable guardrails on every action.
        </p>
      </div>

      {view.status === "loading" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {view.status === "offline" && <DaemonOfflinePanel error={view.error} />}

      {(view.status === "error" || view.status === "drift") && (
        <div className="border border-warning/40 bg-warning/5 rounded-[6px] p-6">
          <p className="font-medium text-warning">{view.error}</p>
        </div>
      )}

      {view.status === "ok" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {view.data.map((p) => (
            <Link
              key={p.name}
              href={`/policies/${p.name}`}
              className="block bg-surface-1 border border-border-subtle rounded-[6px] p-5 hover:border-border-strong transition-colors"
            >
              <div className="flex items-start gap-4">
                <Shield size={20} className="text-accent shrink-0 mt-0.5" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-accent">{p.name}</div>
                  <div className="text-xs text-text-muted mt-1">v{p.version} · {p.source}</div>
                  <div className="flex gap-4 mt-3 font-mono text-xs">
                    <span className="text-success">{p.stats.pass} pass</span>
                    <span className={p.stats.fail > 0 ? "text-danger" : "text-text-muted"}>
                      {p.stats.fail} fail
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

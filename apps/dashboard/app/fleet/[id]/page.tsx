"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";

import { DaemonOfflinePanel } from "@/components/daemon-offline-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { daemonClient } from "@/lib/daemon-client";
import { usePolledDaemon } from "@/lib/use-daemon";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function WalletDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const view = usePolledDaemon(() => daemonClient.fleetWallet(id), 5_000, id);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/fleet" className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors w-fit">
        <ArrowLeft className="h-4 w-4" /> Back to Fleet
      </Link>

      <div>
        <h1 className="text-[28px] font-medium text-text-primary tracking-tight">{id}</h1>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Cell label="Balance" value={`${view.data.wallet.usdcBalance.toFixed(2)} USDC`} mono />
            <Cell
              label="Runway"
              value={view.data.wallet.runwayHours < 1e6 ? `${view.data.wallet.runwayHours.toFixed(0)}h` : "∞"}
              mono
              className={
                view.data.wallet.runwayHours < 24
                  ? "text-danger"
                  : view.data.wallet.runwayHours < 72
                    ? "text-warning"
                    : "text-success"
              }
            />
            <Cell label="Burn (EWMA)" value={`${view.data.wallet.ewmaHourlyBurn.toFixed(3)}/h`} mono />
            <Cell label="Min runway" value={`${view.data.wallet.minRunwayHours}h`} mono />
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-5">
            <div className="text-xs uppercase tracking-wider text-text-muted">Address</div>
            <div className="font-mono text-sm text-text-primary mt-1 break-all">{view.data.wallet.address}</div>
            <div className="text-[11px] text-text-muted mt-1">{view.data.wallet.chainId}</div>
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-5">
            <div className="text-xs uppercase tracking-wider text-text-muted mb-3">Recent samples</div>
            {view.data.samples.length === 0 ? (
              <p className="text-sm text-text-muted">No samples yet.</p>
            ) : (
              <div className="space-y-1 font-mono text-xs text-text-secondary">
                {view.data.samples.slice(-10).reverse().map((s, i) => (
                  <div key={i} className="flex justify-between gap-4 py-1 border-b border-border-subtle">
                    <span>{new Date(s.sampledAt).toLocaleString()}</span>
                    <span>{s.usdcBalance.toFixed(2)} USDC</span>
                    <span>{s.runwayHours < 1e6 ? `${s.runwayHours.toFixed(0)}h` : "∞"}</span>
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

function Cell({ label, value, mono, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-4">
      <div className="text-[11px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`text-base mt-1 ${mono ? "font-mono" : ""} ${className ?? "text-text-primary"}`}>{value}</div>
    </div>
  );
}

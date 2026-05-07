"use client";

import { DaemonOfflinePanel } from "@/components/daemon-offline-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { daemonClient } from "@/lib/daemon-client";
import { usePolledDaemon } from "@/lib/use-daemon";

export default function SettingsPage() {
  const view = usePolledDaemon(() => daemonClient.settings(), 30_000);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-medium text-text-primary tracking-tight">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">
          Read-only configuration. Edit via{" "}
          <code className="font-mono text-accent">zerion qm policy set</code> or{" "}
          <code className="font-mono text-accent">zerion qm tune</code>.
        </p>
      </div>

      {view.status === "loading" && <Skeleton className="h-72 w-full" />}

      {view.status === "offline" && <DaemonOfflinePanel error={view.error} />}

      {(view.status === "error" || view.status === "drift") && (
        <div className="border border-warning/40 bg-warning/5 rounded-[6px] p-6">
          <p className="font-medium text-warning">{view.error}</p>
        </div>
      )}

      {view.status === "ok" && (
        <div className="space-y-4">
          <Section title="Daemon">
            <Row k="version" v={view.data.daemon.version} />
            <Row k="pid" v={String(view.data.daemon.pid)} />
            <Row k="port" v={String(view.data.daemon.port)} />
            <Row k="logLevel" v={view.data.daemon.logLevel} />
          </Section>

          <Section title="Policy defaults">
            <Row k="maxPerActionUsdc" v={view.data.policyDefaults.maxPerActionUsdc.toFixed(2)} />
            <Row k="minCooldownMinutes" v={String(view.data.policyDefaults.minCooldownMinutes)} />
            <Row
              k="burnRateMultiplierThreshold"
              v={`${view.data.policyDefaults.burnRateMultiplierThreshold}×`}
            />
          </Section>

          <Section title="Fleet thresholds">
            <Row k="targetRunwayHours" v={`${view.data.fleetThresholds.targetRunwayHours}h`} />
            <Row k="minRunwayHours" v={`${view.data.fleetThresholds.minRunwayHours}h`} />
            <Row k="minUsdcBalance" v={view.data.fleetThresholds.minUsdcBalance.toFixed(2)} />
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-5">
      <div className="text-xs uppercase tracking-wider text-text-muted mb-3">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border-subtle last:border-b-0">
      <span className="font-mono text-xs text-text-secondary">{k}</span>
      <span className="font-mono text-sm text-text-primary">{v}</span>
    </div>
  );
}

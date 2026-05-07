"use client";

import { useEffect, useState } from "react";
import { Activity, Bot, Landmark } from "lucide-react";

import type { StateResponse } from "@quartermaster/shared-schemas";

import { DaemonOfflinePanel } from "@/components/daemon-offline-panel";
import { LedgerTable } from "@/components/ledger-table";
import { RunwayChart } from "@/components/runway-chart";
import { StatsCard } from "@/components/stats-card";
import { Skeleton } from "@/components/ui/skeleton";
import { daemonClient, subscribeState } from "@/lib/daemon-client";

type View =
  | { kind: "loading" }
  | { kind: "offline"; error: string }
  | { kind: "drift"; error: string }
  | { kind: "ok"; state: StateResponse };

export default function OverviewPage() {
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    // Initial fetch so SSE connection failures don't leave the UI in
    // permanent loading state.
    daemonClient.state().then((result) => {
      if (cancelled) return;
      if (result.status === "ok") setView({ kind: "ok", state: result.data });
      else if (result.status === "offline") setView({ kind: "offline", error: result.error });
      else if (result.status === "drift") setView({ kind: "drift", error: result.error });
      else setView({ kind: "drift", error: result.error });
    });

    // Subscribe to live updates (SSE → polling fallback inside the helper).
    const unsubscribe = subscribeState(
      (next) => {
        if (!cancelled) setView({ kind: "ok", state: next });
      },
      {
        pollMs: 5_000,
        onError: (msg) => {
          if (!cancelled && view.kind !== "ok") {
            setView({ kind: "offline", error: msg });
          }
        },
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (view.kind === "loading") {
    return <OverviewLoading />;
  }
  if (view.kind === "offline") {
    return <OverviewOffline error={view.error} />;
  }
  if (view.kind === "drift") {
    return <OverviewDrift error={view.error} />;
  }

  const { kpis, fleet, treasury, actions } = view.state;
  const chartData = fleet
    .map((wallet) => ({
      id: wallet.id,
      runwayHours: wallet.runwayHours,
      targetRunwayHours: wallet.targetRunwayHours,
    }))
    .sort((a, b) => a.runwayHours - b.runwayHours);
  const minRunway = fleet.length === 0 ? 0 : Math.min(...fleet.map((w) => w.runwayHours));

  return (
    <div className="flex flex-col gap-8 max-w-[1200px] mx-auto pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-text-primary">Overview</h1>
        <p className="text-text-secondary">At-a-glance health of your agent economy.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="WALLETS"
          value={kpis.totalFleetBalance.toFixed(2)}
          subMetrics={[
            { label: "Active wallets", value: fleet.length.toString() },
            {
              label: "Min runway",
              value: minRunway < 1e6 ? `${minRunway.toFixed(0)}h` : "—",
              valueClassName:
                minRunway < 24
                  ? "text-danger"
                  : minRunway <= 72
                    ? "text-warning"
                    : "text-success",
            },
          ]}
          icon={<Bot size={20} />}
        />
        <StatsCard
          title="TREASURY VALUE"
          value={`$${kpis.totalTreasuryBalance.toFixed(0)}`}
          subMetrics={[
            { label: "Active sources", value: treasury.length.toString() },
          ]}
          icon={<Landmark size={20} />}
        />
        <StatsCard
          title="TOP-UPS"
          value={kpis.actions24h.toString()}
          subMetrics={[{ label: "Time period", value: "24h" }]}
          icon={<Activity size={20} />}
        />
      </div>

      <div className="w-full mt-2">
        <RunwayChart data={chartData} />
      </div>

      <div className="w-full mt-2">
        <LedgerTable
          actions={actions.filter((a) => !a.actionId.startsWith("00000000-0000-"))}
        />
      </div>
    </div>
  );
}

function OverviewLoading() {
  return (
    <div className="flex flex-col gap-8 max-w-[1200px] mx-auto pb-12">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function OverviewOffline({ error }: { error: string }) {
  return (
    <div className="flex flex-col gap-8 max-w-[1200px] mx-auto pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-text-primary">Overview</h1>
        <p className="text-text-secondary">At-a-glance health of your agent economy.</p>
      </div>
      <DaemonOfflinePanel error={error} />
    </div>
  );
}

function OverviewDrift({ error }: { error: string }) {
  return (
    <div className="flex flex-col gap-8 max-w-[1200px] mx-auto pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-text-primary">Overview</h1>
      </div>
      <div className="border border-warning/40 bg-warning/5 rounded-[6px] p-6">
        <p className="font-medium text-warning">Daemon response shape mismatch.</p>
        <p className="text-sm text-text-secondary mt-2">
          The daemon is reachable but returned data the dashboard could not parse. This usually
          means the daemon and dashboard are running on incompatible versions.
        </p>
        <p className="text-[11px] text-text-muted mt-3 font-mono">{error}</p>
      </div>
    </div>
  );
}

import { StatsCard } from "@/components/stats-card";
import { RunwayChart } from "@/components/runway-chart";
import { LedgerTable } from "@/components/ledger-table";
import { Bot, Landmark, Activity } from "lucide-react";

// In a real app, this would be fetched from the daemon or imported directly
import stateData from "@/lib/fixtures/state.json";

export default function OverviewPage() {
  const { kpis, fleet, actions } = stateData;

  // Format data for RunwayChart
  const chartData = fleet.map(wallet => ({
    id: wallet.id,
    runwayHours: wallet.runwayHours,
    targetRunwayHours: wallet.targetRunwayHours
  })).sort((a, b) => a.runwayHours - b.runwayHours);

  const minRunway = Math.min(...fleet.map(w => w.runwayHours));

  return (
    <div className="flex flex-col gap-8 max-w-[1200px] mx-auto pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-text-primary">Overview</h1>
        <p className="text-text-secondary">At-a-glance health of your agent economy.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard 
          title="WALLETS" 
          value={`${kpis.totalFleetBalance.toFixed(2)}`}
          subMetrics={[
            { label: "Active wallets", value: fleet.length.toString() },
            { 
              label: "Min runway", 
              value: `${minRunway}h`,
              valueClassName: minRunway < 24 ? "text-danger" : minRunway <= 72 ? "text-warning" : "text-success"
            }
          ]}
          icon={<Bot size={20} />}
        />
        <StatsCard 
          title="TREASURY VALUE" 
          value={`$${kpis.totalTreasuryBalance.toFixed(0)}`}
          subMetrics={[
            { label: "Active sources", value: stateData.treasury.length.toString() }
          ]}
          icon={<Landmark size={20} />}
        />
        <StatsCard 
          title="TOP-UPS" 
          value={kpis.actions24h.toString()}
          subMetrics={[
            { label: "Time period", value: "24h" }
          ]}
          icon={<Activity size={20} />}
        />
      </div>

      <div className="w-full mt-2">
        <RunwayChart data={chartData} />
      </div>

      <div className="w-full mt-2">
        <LedgerTable actions={actions} />
      </div>
    </div>
  );
}

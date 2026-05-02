"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";

interface RunwayChartProps {
  data: {
    id: string;
    runwayHours: number;
    targetRunwayHours: number;
  }[];
}

export function RunwayChart({ data }: RunwayChartProps) {
  // Dynamic height based on number of wallets, min 250px
  const chartHeight = Math.max(250, data.length * 48 + 60);

  return (
    <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-6 shadow-sm w-full overflow-hidden">
      <h3 className="text-sm font-medium text-text-secondary mb-6">Fleet Runway (Hours)</h3>
      <div style={{ width: '100%', height: chartHeight, minWidth: 0 }}>
        <ResponsiveContainer width="99%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
            <XAxis type="number" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis 
              dataKey="id" 
              type="category" 
              stroke="var(--color-text-secondary)" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              width={120}
            />
            <Tooltip 
              cursor={{ fill: 'var(--color-surface-2)' }}
              contentStyle={{ backgroundColor: 'var(--color-surface-1)', borderColor: 'var(--color-border-strong)' }}
              itemStyle={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-jetbrains-mono)' }}
            />
            <Bar dataKey="runwayHours" radius={[0, 4, 4, 0]} maxBarSize={32}>
              {data.map((entry, index) => {
                let color = "var(--color-success)";
                if (entry.runwayHours < 24) color = "var(--color-danger)";
                else if (entry.runwayHours <= 72) color = "var(--color-warning)";
                
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

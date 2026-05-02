import { ReactNode } from "react";

export interface SubMetric {
  label: string;
  value: string | ReactNode;
  valueClassName?: string;
}

interface StatsCardProps {
  title: string;
  value: string;
  subMetrics?: SubMetric[];
  icon?: ReactNode;
}

export function StatsCard({ title, value, subMetrics, icon }: StatsCardProps) {
  return (
    <div className="bg-surface-1 border border-border-subtle rounded-[6px] shadow-sm flex flex-col p-[28px]">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h3 className="text-[12px] uppercase tracking-[0.1em] text-text-muted font-medium mb-[8px]">
            {title}
          </h3>
          <div className="text-[40px] leading-none font-mono text-text-primary">
            {value}
          </div>
        </div>
        {icon && <div className="text-text-muted">{icon}</div>}
      </div>
      
      {subMetrics && subMetrics.length > 0 && (
        <div className="mt-[16px] pt-[16px] border-t border-border-subtle flex flex-col gap-2">
          {subMetrics.map((metric, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-text-muted">{metric.label}</span>
              <span className={`font-mono text-text-secondary ${metric.valueClassName || ""}`}>
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

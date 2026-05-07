"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft, CheckCircle2, Clock, ShieldAlert, XCircle } from "lucide-react";

import type { TopUpAction } from "@quartermaster/shared-schemas";

import { DaemonOfflinePanel } from "@/components/daemon-offline-panel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { daemonClient } from "@/lib/daemon-client";
import { usePolledDaemon } from "@/lib/use-daemon";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ActionDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const view = usePolledDaemon(() => daemonClient.action(id), 3_000, id);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/actions"
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Actions
      </Link>

      <div>
        <h1 className="text-[28px] font-medium text-text-primary tracking-tight">Action Detail</h1>
        <p className="text-sm text-text-secondary mt-1 font-mono">{id}</p>
      </div>

      {view.status === "loading" && <Skeleton className="h-96 w-full" />}

      {view.status === "offline" && <DaemonOfflinePanel error={view.error} />}

      {(view.status === "error" || view.status === "drift") && (
        <div className="border border-warning/40 bg-warning/5 rounded-[6px] p-6">
          <p className="font-medium text-warning">{view.error}</p>
        </div>
      )}

      {view.status === "ok" && <ActionDetail action={view.data} />}
    </div>
  );
}

function ActionDetail({ action }: { action: TopUpAction }) {
  const isBlocked = action.state === "blocked";
  const isError = action.state === "error";
  const isConfirmed = action.state === "confirmed";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-5">
          <div className="text-xs uppercase tracking-wider text-text-muted">Target wallet</div>
          <div className="text-lg font-medium text-text-primary mt-1">{action.targetWalletId}</div>
        </div>
        <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-5">
          <div className="text-xs uppercase tracking-wider text-text-muted">Amount</div>
          <div className="text-lg font-mono font-medium text-text-primary mt-1">
            {action.topUpAmountUsdc.toFixed(2)} USDC
          </div>
        </div>
        <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-5">
          <div className="text-xs uppercase tracking-wider text-text-muted">Source</div>
          <div className="text-lg font-medium text-text-primary mt-1">{action.sourceId}</div>
        </div>
      </div>

      <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-5">
        <div className="text-xs uppercase tracking-wider text-text-muted mb-3">State</div>
        <div className="flex items-center gap-3">
          <Badge
            variant={
              isConfirmed
                ? "success"
                : isBlocked || isError
                  ? "destructive"
                  : "default"
            }
          >
            {action.state}
          </Badge>
          {action.reasonCodeFinal && (
            <span className="font-mono text-xs text-danger">{action.reasonCodeFinal}</span>
          )}
        </div>
      </div>

      {/* J1 demo focal point: blocked actions surface the failing policy loud. */}
      {isBlocked && (
        <div className="bg-surface-1 border-2 border-danger/40 rounded-[6px] p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert size={24} className="text-danger flex-shrink-0 mt-1" />
            <div className="flex-1">
              <p className="font-medium text-text-primary">Policy refusal</p>
              <p className="text-sm text-text-secondary mt-1">
                One of the five layer-1 policies blocked this action before it reached signing.
              </p>
              {action.policyChecks
                .filter((c) => !c.passed)
                .map((check) => (
                  <div
                    key={check.policyName}
                    className="mt-4 bg-surface-2 border border-border-subtle rounded p-4"
                  >
                    <div className="flex items-center gap-2 font-mono text-sm text-accent">
                      <XCircle size={16} className="text-danger" />
                      {check.policyName}
                    </div>
                    {check.reasonCode && (
                      <div className="mt-2 font-mono text-xs text-danger">{check.reasonCode}</div>
                    )}
                    {check.reasonText && (
                      <div className="mt-2 text-sm text-text-secondary">{check.reasonText}</div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-5">
        <div className="text-xs uppercase tracking-wider text-text-muted mb-4">Policy evaluations</div>
        <div className="space-y-2">
          {action.policyChecks.length === 0 && (
            <p className="text-sm text-text-muted">No evaluations recorded.</p>
          )}
          {action.policyChecks.map((check, i) => (
            <div
              key={`${check.policyName}-${i}`}
              className="flex items-start gap-3 p-3 rounded bg-surface-2"
            >
              {check.passed ? (
                <CheckCircle2 size={18} className="text-success flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle size={18} className="text-danger flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm text-text-primary">{check.policyName}</div>
                {check.reasonCode && (
                  <div className="font-mono text-xs text-danger mt-1">{check.reasonCode}</div>
                )}
                {check.reasonText && (
                  <div className="text-xs text-text-secondary mt-1">{check.reasonText}</div>
                )}
              </div>
              <div className="text-[10px] text-text-muted font-mono whitespace-nowrap">
                {new Date(check.evaluatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-5">
        <div className="text-xs uppercase tracking-wider text-text-muted mb-3">Transactions</div>
        {Object.keys(action.txHashes).length === 0 ? (
          <p className="text-sm text-text-muted">No transactions executed.</p>
        ) : (
          <div className="space-y-2">
            {(["swap", "bridge", "send"] as const).map((leg) => {
              const hash = action.txHashes[leg];
              if (!hash) return null;
              return (
                <div key={leg} className="flex items-center gap-3 p-2 rounded bg-surface-2">
                  <span className="text-xs uppercase tracking-wider text-text-muted w-12">{leg}</span>
                  <a
                    href={`https://sepolia.basescan.org/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-accent hover:text-accent-hover transition-colors truncate"
                  >
                    {hash}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-surface-1 border border-border-subtle rounded-[6px] p-5">
        <div className="text-xs uppercase tracking-wider text-text-muted mb-3">Timeline</div>
        <div className="flex items-center gap-2 text-sm font-mono text-text-secondary">
          <Clock size={14} />
          <span>created {new Date(action.createdAt).toLocaleString()}</span>
        </div>
        {action.confirmedAt && (
          <div className="flex items-center gap-2 text-sm font-mono text-text-secondary mt-1">
            <CheckCircle2 size={14} className="text-success" />
            <span>confirmed {new Date(action.confirmedAt).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

import { DAEMON_URL, isDeployedDaemon } from "@/lib/daemon-url";

export function DaemonStatusPill() {
  const [status, setStatus] = useState<"online" | "offline">("offline");
  const deployed = isDeployedDaemon();

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${DAEMON_URL}/api/health`);
        if (res.ok) {
          setStatus("online");
        } else {
          setStatus("offline");
        }
      } catch {
        setStatus("offline");
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-2 border border-border-subtle">
      <div
        className={`w-2 h-2 rounded-full ${status === "online" ? "bg-success" : "bg-danger"}`}
      />
      <span className="font-sans text-[13px] font-medium tracking-[0.02em] text-text-secondary">
        Daemon {status}
      </span>
      {deployed && (
        <span
          className="font-mono text-[10px] tracking-[0.15em] uppercase text-accent border border-accent/40 rounded px-1.5 py-px ml-1"
          title={`Public daemon at ${DAEMON_URL}`}
        >
          Deployed
        </span>
      )}
    </div>
  );
}

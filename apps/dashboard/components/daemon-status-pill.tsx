"use client";

import { useEffect, useState } from "react";

export function DaemonStatusPill() {
  const [status, setStatus] = useState<"online" | "offline">("offline");

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("http://127.0.0.1:7402/api/health");
        if (res.ok) {
          setStatus("online");
        } else {
          setStatus("offline");
        }
      } catch (err) {
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
    </div>
  );
}

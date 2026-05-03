"use client";

import { useEffect, useState } from "react";

export function DaemonBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("http://127.0.0.1:7402/api/health");
        setOffline(!res.ok);
      } catch (err) {
        setOffline(true);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!offline) return null;

  return (
    <div className="w-full bg-danger text-text-inverse px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="font-medium text-sm">Daemon offline — run</span>
        <code className="bg-surface-3/50 text-text-primary px-2 py-1 rounded font-mono text-xs">
          zerion qm run
        </code>
      </div>
    </div>
  );
}

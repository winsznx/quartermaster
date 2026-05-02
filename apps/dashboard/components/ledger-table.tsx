import { Badge } from "./ui/badge";

interface Action {
  actionId: string;
  targetWalletId: string;
  topUpAmountUsdc: number;
  state: string;
  txHashes: {
    send?: string;
    swap?: string;
    bridge?: string;
  };
  createdAt: string;
}

interface LedgerTableProps {
  actions: Action[];
}

export function LedgerTable({ actions }: LedgerTableProps) {
  return (
    <div className="bg-surface-1 border border-border-subtle rounded-[6px] shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border-subtle">
        <h3 className="text-sm font-medium text-text-primary">Recent Actions</h3>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-2 text-text-secondary text-xs font-medium uppercase tracking-wider">
              <th className="px-6 py-3 font-medium">Time</th>
              <th className="px-6 py-3 font-medium">Wallet</th>
              <th className="px-6 py-3 font-medium">Amount</th>
              <th className="px-6 py-3 font-medium">State</th>
              <th className="px-6 py-3 font-medium">Tx Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {actions.map((action) => {
              const date = new Date(action.createdAt);
              const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              let badgeVariant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" = "default";
              if (action.state === "confirmed") badgeVariant = "success";
              else if (action.state === "blocked" || action.state === "error") badgeVariant = "destructive";
              
              const txHash = action.txHashes?.send || action.txHashes?.swap || "-";

              return (
                <tr key={action.actionId} className="hover:bg-surface-2/50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                    {timeString}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">
                    {action.targetWalletId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-text-primary">
                    {action.topUpAmountUsdc.toFixed(2)} USDC
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Badge variant={badgeVariant}>
                      {action.state}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-text-muted">
                    {txHash !== "-" ? (
                      <span className="truncate max-w-[120px] inline-block align-bottom">{txHash}</span>
                    ) : "-"}
                  </td>
                </tr>
              );
            })}
            {actions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-text-muted">
                  No recent actions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

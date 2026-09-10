import type { ReactNode } from "react";
import { GatewayStatusBadge } from "@/components/shared/gateway-status-badge";

// Coquille du groupe (dashboard) : header persistant portant le badge de
// statut du Gateway IBKR (spec fonctionnelle Module 1, spec technique 8.2).
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-end border-b border-border px-6 py-3">
        <GatewayStatusBadge />
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

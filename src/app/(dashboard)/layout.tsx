import type { ReactNode } from "react";
import Link from "next/link";
import { GatewayStatusBadge } from "@/components/shared/gateway-status-badge";

// Coquille du groupe (dashboard) : header persistant portant la navigation
// et le badge de statut du Gateway IBKR (spec fonctionnelle Module 1, spec
// technique 8.2).
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-foreground hover:underline">
            Dashboard
          </Link>
          <Link href="/watchlists" className="text-foreground hover:underline">
            Watchlists
          </Link>
        </nav>
        <GatewayStatusBadge />
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

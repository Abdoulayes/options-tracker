"use client";

import { cn } from "cn";
import { useGatewayHealth } from "@/hooks/use-gateway-health";

const STATUS_LABEL: Record<string, string> = {
  connected: "Gateway IBKR connecté",
  disconnected: "Gateway IBKR déconnecté",
  unknown: "Statut du Gateway en cours de vérification…",
};

const STATUS_DOT_CLASS: Record<string, string> = {
  connected: "bg-emerald-500",
  disconnected: "bg-destructive",
  unknown: "bg-muted-foreground",
};

export function GatewayStatusBadge() {
  const { data, isError } = useGatewayHealth();

  // Une erreur réseau côté route applicative (ex. session expirée) est
  // traitée comme un statut inconnu, jamais comme un crash de l'UI.
  const status = isError ? "unknown" : (data?.status ?? "unknown");
  const label = STATUS_LABEL[status];

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground"
      title={label}
    >
      <span
        className={cn("size-2 rounded-full", STATUS_DOT_CLASS[status])}
        aria-hidden
      />
      <span>{label}</span>
      {status === "connected" && data?.latencyMs !== null && (
        <span className="text-muted-foreground">{data?.latencyMs} ms</span>
      )}
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";

export type GatewayHealthResponse = {
  status: "connected" | "disconnected" | "unknown";
  consecutiveFailures: number;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  accountId: string | null;
};

// Polling de l'endpoint applicatif /api/ibkr/health — jamais d'appel direct
// au Gateway depuis le navigateur (spec technique 8.2). L'intervalle est
// aligné sur la fréquence du heartbeat serveur (40s).
const POLL_INTERVAL_MS = 40_000;

async function fetchGatewayHealth(): Promise<GatewayHealthResponse> {
  const response = await fetch("/api/ibkr/health");
  if (!response.ok) {
    throw new Error("Impossible de récupérer le statut du Gateway IBKR.");
  }
  return response.json();
}

export function useGatewayHealth() {
  return useQuery({
    queryKey: ["ibkr", "health"],
    queryFn: fetchGatewayHealth,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}

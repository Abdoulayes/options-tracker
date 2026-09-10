// Logique pure de détection de panne du Gateway IBKR — spec technique
// section 8.1 : deux échecs consécutifs de heartbeat font basculer le statut
// en "déconnecté". Aucune I/O ici (facilement testable), cf. heartbeat-service.ts
// pour l'orchestration.

export type GatewayConnectionStatus = "connected" | "disconnected" | "unknown";

export const CONSECUTIVE_FAILURES_THRESHOLD = 2;

export type GatewayHealthState = {
  status: GatewayConnectionStatus;
  consecutiveFailures: number;
  lastCheckedAt: Date | null;
  lastSuccessAt: Date | null;
  latencyMs: number | null;
};

export const initialGatewayHealthState: GatewayHealthState = {
  status: "unknown",
  consecutiveFailures: 0,
  lastCheckedAt: null,
  lastSuccessAt: null,
  latencyMs: null,
};

export type HeartbeatOutcome =
  { success: true; latencyMs: number } | { success: false };

export function nextGatewayHealthState(
  current: GatewayHealthState,
  outcome: HeartbeatOutcome,
  now: Date,
): GatewayHealthState {
  if (outcome.success) {
    return {
      status: "connected",
      consecutiveFailures: 0,
      lastCheckedAt: now,
      lastSuccessAt: now,
      latencyMs: outcome.latencyMs,
    };
  }

  const consecutiveFailures = current.consecutiveFailures + 1;
  const status: GatewayConnectionStatus =
    consecutiveFailures >= CONSECUTIVE_FAILURES_THRESHOLD
      ? "disconnected"
      : current.status;

  return {
    status,
    consecutiveFailures,
    lastCheckedAt: now,
    lastSuccessAt: current.lastSuccessAt,
    latencyMs: null,
  };
}

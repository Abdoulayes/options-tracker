import { describe, expect, it } from "vitest";
import {
  CONSECUTIVE_FAILURES_THRESHOLD,
  initialGatewayHealthState,
  nextGatewayHealthState,
  type GatewayHealthState,
} from "@/lib/ibkr-gateway/connection-status";

describe("gateway connection-status", () => {
  const now = new Date("2026-09-10T12:00:00.000Z");
  const later = new Date("2026-09-10T12:00:40.000Z");

  it("part d'un statut inconnu", () => {
    expect(initialGatewayHealthState.status).toBe("unknown");
  });

  it("passe à connecté après un heartbeat réussi", () => {
    const state = nextGatewayHealthState(
      initialGatewayHealthState,
      { success: true, latencyMs: 42 },
      now,
    );

    expect(state.status).toBe("connected");
    expect(state.consecutiveFailures).toBe(0);
    expect(state.latencyMs).toBe(42);
    expect(state.lastSuccessAt).toEqual(now);
  });

  it("ne bascule pas en déconnecté après un seul échec", () => {
    const connected: GatewayHealthState = {
      status: "connected",
      consecutiveFailures: 0,
      lastCheckedAt: now,
      lastSuccessAt: now,
      latencyMs: 42,
    };

    const state = nextGatewayHealthState(connected, { success: false }, later);

    expect(state.status).toBe("connected");
    expect(state.consecutiveFailures).toBe(1);
  });

  it("bascule en déconnecté après deux échecs consécutifs", () => {
    let state: GatewayHealthState = {
      status: "connected",
      consecutiveFailures: 0,
      lastCheckedAt: now,
      lastSuccessAt: now,
      latencyMs: 42,
    };

    for (let i = 0; i < CONSECUTIVE_FAILURES_THRESHOLD; i++) {
      state = nextGatewayHealthState(state, { success: false }, later);
    }

    expect(state.status).toBe("disconnected");
    expect(state.consecutiveFailures).toBe(CONSECUTIVE_FAILURES_THRESHOLD);
  });

  it("conserve la date du dernier succès pendant une panne", () => {
    let state: GatewayHealthState = {
      status: "connected",
      consecutiveFailures: 0,
      lastCheckedAt: now,
      lastSuccessAt: now,
      latencyMs: 42,
    };

    state = nextGatewayHealthState(state, { success: false }, later);
    state = nextGatewayHealthState(state, { success: false }, later);

    expect(state.lastSuccessAt).toEqual(now);
  });

  it("se rétablit immédiatement dès qu'un heartbeat réussit à nouveau", () => {
    let state: GatewayHealthState = {
      status: "disconnected",
      consecutiveFailures: 5,
      lastCheckedAt: later,
      lastSuccessAt: now,
      latencyMs: null,
    };

    state = nextGatewayHealthState(
      state,
      { success: true, latencyMs: 10 },
      later,
    );

    expect(state.status).toBe("connected");
    expect(state.consecutiveFailures).toBe(0);
  });
});

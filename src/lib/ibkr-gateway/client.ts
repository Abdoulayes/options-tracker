import { Agent, fetch as undiciFetch } from "undici";
import { appConfig } from "@/lib/app-config";
import type {
  GatewayError,
  GatewayResult,
  IBKRAccountsResponse,
  IBKRAuthStatus,
  IBKRSecdefSearchResult,
  IBKRTickleResponse,
} from "@/lib/ibkr-gateway/types";

// Client HTTP dédié au Client Portal Gateway IBKR — spec technique section
// 6.1. Seul module autorisé à parler au Gateway ; jamais appelé depuis le
// navigateur (toujours via une route API Next.js, cf. CLAUDE.md).

const REQUEST_TIMEOUT_MS = 10_000;

// Le Gateway IBKR sert toujours son certificat auto-signé, y compris en
// Paper Trading. On ne relâche la vérification TLS qu'en développement
// explicite — jamais en production (cf. CLAUDE.md, spec technique 6.1).
const insecureDevAgent =
  process.env.NODE_ENV === "development"
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;

async function callGateway<T>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown },
): Promise<GatewayResult<T>> {
  const start = performance.now();

  try {
    const response = await undiciFetch(`${appConfig.ibkr.gatewayUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      dispatcher: insecureDevAgent,
    });
    const latencyMs = Math.round(performance.now() - start);

    if (!response.ok) {
      const error: GatewayError = {
        kind: "http_error",
        message: `Le Gateway IBKR a répondu avec le statut ${response.status}.`,
        status: response.status,
      };
      return { ok: false, error, latencyMs };
    }

    const data = (await response.json()) as T;
    return { ok: true, data, latencyMs };
  } catch (cause) {
    const latencyMs = Math.round(performance.now() - start);
    return { ok: false, error: toGatewayError(cause), latencyMs };
  }
}

function toGatewayError(cause: unknown): GatewayError {
  if (cause instanceof Error && cause.name === "TimeoutError") {
    return {
      kind: "timeout",
      message: "Le Gateway IBKR n'a pas répondu dans le délai imparti.",
    };
  }
  if (cause instanceof SyntaxError) {
    return {
      kind: "invalid_response",
      message: "Réponse du Gateway IBKR illisible (JSON invalide).",
    };
  }
  return {
    kind: "network",
    message: "Le Gateway IBKR est injoignable.",
  };
}

// GET /v1/api/iserver/auth/status — statut de session brut.
export function getAuthStatus(): Promise<GatewayResult<IBKRAuthStatus>> {
  return callGateway<IBKRAuthStatus>("/v1/api/iserver/auth/status", {
    method: "GET",
  });
}

// POST /v1/api/tickle — endpoint de maintien de session (heartbeat).
export function tickleSession(): Promise<GatewayResult<IBKRTickleResponse>> {
  return callGateway<IBKRTickleResponse>("/v1/api/tickle", {
    method: "POST",
  });
}

// GET /v1/api/iserver/accounts — récupération dynamique de l'accountId actif
// (ne jamais le coder en dur, cf. spec technique 6.3).
export function getAccounts(): Promise<GatewayResult<IBKRAccountsResponse>> {
  return callGateway<IBKRAccountsResponse>("/v1/api/iserver/accounts", {
    method: "GET",
  });
}

// POST /v1/api/iserver/secdef/search — résolution d'un symbole en conid pour
// l'autocomplete d'ajout de ticker (Lot 3, spec technique section 7).
export function searchTicker(
  symbol: string,
): Promise<GatewayResult<IBKRSecdefSearchResult[]>> {
  return callGateway<IBKRSecdefSearchResult[]>(
    "/v1/api/iserver/secdef/search",
    {
      method: "POST",
      body: { symbol, name: false, secType: "STK" },
    },
  );
}

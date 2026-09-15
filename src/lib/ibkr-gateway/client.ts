import { Agent, fetch as undiciFetch } from "undici";
import { appConfig } from "@/lib/app-config";
import type {
  GatewayError,
  GatewayResult,
  IBKRAccountsResponse,
  IBKRAuthStatus,
  IBKRMarketDataSnapshot,
  IBKRSecdefInfoResult,
  IBKRSecdefSearchResult,
  IBKRSecdefStrikesResponse,
  IBKRTickleResponse,
} from "@/lib/ibkr-gateway/types";

// Field ids du snapshot marketdata IBKR (Lot 4) — à valider contre le
// Gateway réel avant mise en production, au même titre que les autres
// intégrations IBKR de ce projet (cf. CLAUDE.md, validation manuelle du
// Lot 2).
export const MARKET_DATA_FIELD_IDS = {
  last: "31",
  bid: "84",
  ask: "86",
  volume: "87",
  impliedVolatility: "7283",
  delta: "7308",
  gamma: "7309",
  theta: "7310",
  vega: "7311",
  openInterest: "7633",
} as const;

// Client HTTP dédié au Client Portal Gateway IBKR — spec technique section
// 6.1. Seul module autorisé à parler au Gateway ; jamais appelé depuis le
// navigateur (toujours via une route API Next.js, cf. CLAUDE.md).

const REQUEST_TIMEOUT_MS = 10_000;

// Le Gateway IBKR renvoie un 429 ("Too Many Requests") au-delà d'un certain
// débit — observé en pratique lors de la résolution en rafale des conids
// d'une chaîne d'options (Lot 4). On retente quelques fois avec un backoff
// avant d'abandonner, plutôt que de remonter l'erreur immédiatement.
const RATE_LIMIT_MAX_RETRIES = 3;
const RATE_LIMIT_BACKOFF_MS = 1_000;

// Le Gateway IBKR sert toujours son certificat auto-signé, y compris en
// Paper Trading. On ne relâche la vérification TLS qu'en développement
// explicite — jamais en production (cf. CLAUDE.md, spec technique 6.1).
const insecureDevAgent =
  process.env.NODE_ENV === "development"
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGateway<T>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown },
): Promise<GatewayResult<T>> {
  const start = performance.now();

  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
    try {
      const response = await undiciFetch(
        `${appConfig.ibkr.gatewayUrl}${path}`,
        {
          method: init?.method ?? "GET",
          headers: {
            Accept: "application/json",
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
          },
          body: init?.body ? JSON.stringify(init.body) : undefined,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          dispatcher: insecureDevAgent,
        },
      );
      const latencyMs = Math.round(performance.now() - start);

      if (!response.ok) {
        if (response.status === 429 && attempt < RATE_LIMIT_MAX_RETRIES) {
          await response.body?.cancel().catch(() => undefined);
          await wait(RATE_LIMIT_BACKOFF_MS * (attempt + 1));
          continue;
        }

        // Le corps brut n'est jamais renvoyé au frontend (spec technique
        // section 7) mais on le journalise côté serveur pour le diagnostic —
        // aucune donnée financière/secrète dans ce contexte, seulement le
        // détail de rejet de la requête par le Gateway.
        const rawBody = await response.text().catch(() => "");
        console.error(
          `[ibkr-gateway] ${path} → ${response.status} : ${rawBody}`,
        );

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

  // Inatteignable : la boucle retourne toujours avant d'en sortir (soit un
  // résultat, soit un `continue` qui reboucle) ; TypeScript exige néanmoins
  // un retour explicite en fin de fonction.
  return {
    ok: false,
    error: {
      kind: "http_error",
      message: "Le Gateway IBKR a répondu avec le statut 429.",
      status: 429,
    },
    latencyMs: Math.round(performance.now() - start),
  };
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

// GET /v1/api/iserver/secdef/strikes — strikes disponibles pour un
// conid/mois d'expiration donné (Lot 4, spec fonctionnelle Module 4).
export function getOptionStrikes(
  conid: string,
  month: string,
): Promise<GatewayResult<IBKRSecdefStrikesResponse>> {
  const params = new URLSearchParams({
    conid,
    sectype: "OPT",
    month,
    exchange: "SMART",
  });
  return callGateway<IBKRSecdefStrikesResponse>(
    `/v1/api/iserver/secdef/strikes?${params.toString()}`,
    { method: "GET" },
  );
}

// GET /v1/api/iserver/secdef/info — résolution des conids Call/Put d'un
// strike donné (Lot 4). Sans paramètre `right`, le Gateway renvoie les deux
// côtés du contrat.
export function getOptionContractInfo(
  conid: string,
  month: string,
  strike: number,
): Promise<GatewayResult<IBKRSecdefInfoResult[]>> {
  const params = new URLSearchParams({
    conid,
    sectype: "OPT",
    month,
    strike: String(strike),
  });
  return callGateway<IBKRSecdefInfoResult[]>(
    `/v1/api/iserver/secdef/info?${params.toString()}`,
    { method: "GET" },
  );
}

// GET /v1/api/iserver/marketdata/snapshot — snapshot de marché pour une
// liste de conids (sous-jacent + options, Lot 4).
export function getMarketDataSnapshot(
  conids: string[],
  fields: string[],
): Promise<GatewayResult<IBKRMarketDataSnapshot[]>> {
  const params = new URLSearchParams({
    conids: conids.join(","),
    fields: fields.join(","),
  });
  return callGateway<IBKRMarketDataSnapshot[]>(
    `/v1/api/iserver/marketdata/snapshot?${params.toString()}`,
    { method: "GET" },
  );
}

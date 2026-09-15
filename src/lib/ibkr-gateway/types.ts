// Formes des réponses brutes du Client Portal Gateway IBKR (API v1) utilisées
// par ce lot. Volontairement minimales : seuls les champs exploités par le
// client sont typés, le reste de la réponse Gateway est ignoré.

export type IBKRAuthStatus = {
  authenticated: boolean;
  connected: boolean;
  competing: boolean;
  message?: string;
  fail?: string;
};

export type IBKRTickleResponse = {
  session: string;
  iserver?: {
    authStatus?: IBKRAuthStatus;
  };
};

export type IBKRAccountsResponse = {
  accounts: string[];
  selectedAccount?: string;
};

// POST /v1/api/iserver/secdef/search — recherche de ticker (autocomplete,
// Lot 3). Réponse Gateway volontairement réduite aux champs exploités.
// La section "OPT" (Lot 4) porte les mois d'expiration disponibles au
// format "SEP26;OCT26;..." — c'est la seule source d'expirations exposée
// par le Gateway sans connaître déjà une expiration précise.
export type IBKRSecdefSearchSection = {
  secType: string;
  months?: string;
};

export type IBKRSecdefSearchResult = {
  conid: string;
  symbol: string;
  companyHeader?: string;
  companyName?: string;
  sections?: IBKRSecdefSearchSection[];
};

// GET /v1/api/iserver/secdef/strikes — strikes disponibles pour un
// conid/mois d'expiration donné (Lot 4).
export type IBKRSecdefStrikesResponse = {
  call: number[];
  put: number[];
};

// GET /v1/api/iserver/secdef/info — résolution du conid d'un contrat
// d'option pour un strike donné. Sans le paramètre `right`, le Gateway
// renvoie les deux côtés (Call et Put) du strike (Lot 4).
export type IBKRSecdefInfoResult = {
  conid: number;
  right: "C" | "P";
  strike: number;
  maturityDate: string; // format YYYYMMDD
};

// POST /v1/api/iserver/marketdata/snapshot — snapshot de marché par conid.
// Les clés numériques correspondent aux "field ids" du Gateway IBKR ; voir
// FIELD_IDS dans client.ts. Champs optionnels : le Gateway ne renvoie une
// clé que s'il a une valeur à donner pour ce conid à cet instant.
export type IBKRMarketDataSnapshot = {
  conid: number;
  "31"?: string; // Last
  "84"?: string; // Bid
  "86"?: string; // Ask
  "87"?: string; // Volume (formaté)
  "7283"?: string; // Implied Volatility %
  "7308"?: string; // Delta
  "7309"?: string; // Gamma
  "7310"?: string; // Theta
  "7311"?: string; // Vega
  "7633"?: string; // Open Interest
};

// Erreurs normalisées côté client : ne jamais propager le corps brut d'une
// erreur Gateway au frontend (spec technique section 7).
export type GatewayErrorKind =
  "timeout" | "network" | "http_error" | "invalid_response";

export type GatewayError = {
  kind: GatewayErrorKind;
  message: string;
  status?: number;
};

export type GatewayResult<T> =
  | { ok: true; data: T; latencyMs: number }
  | { ok: false; error: GatewayError; latencyMs: number };

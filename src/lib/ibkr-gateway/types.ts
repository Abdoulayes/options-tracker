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

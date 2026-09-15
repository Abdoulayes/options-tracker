"use client";

import { useQuery } from "@tanstack/react-query";

export type OptionQuote = {
  conid: number;
  maturityDate: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  volume: number | null;
  openInterest: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  impliedVolatility: number | null;
};

export type OptionsChainRow = {
  strike: number;
  distancePct: number;
  put: OptionQuote | null;
  call: OptionQuote | null;
};

export type OptionsChainResponse = {
  expirations: string[];
  selectedExpiration: string;
  // Un "mois" IBKR peut regrouper plusieurs échéances réelles (options
  // hebdomadaires) : ce sont les dates YYYYMMDD réellement disponibles dans
  // le mois sélectionné, et celle effectivement utilisée pour `rows`.
  availableMaturityDates: string[];
  selectedMaturityDate: string | null;
  underlying: { conid: number; last: number | null };
  rows: OptionsChainRow[];
  targetDeltaMin: number;
  targetDeltaMax: number;
};

// Pas de polling automatique sur cet endpoint : reconstruire la chaîne
// complète enchaîne des dizaines d'appels Gateway (un par strike) et un
// rafraîchissement périodique déclenche rapidement un 429 ("Too Many
// Requests") de la part du Gateway IBKR. L'utilisateur rafraîchit
// manuellement (changement d'expiration, retour sur la page).
async function fetchOptionsChain(
  symbol: string,
  conid: string,
  expiration?: string,
  maturityDate?: string,
): Promise<OptionsChainResponse> {
  const params = new URLSearchParams({ symbol, conid });
  if (expiration) {
    params.set("expiration", expiration);
  }
  if (maturityDate) {
    params.set("maturityDate", maturityDate);
  }
  const response = await fetch(`/api/ibkr/options-chain?${params.toString()}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data.message ?? data.error ?? "Chaîne d'options indisponible.",
    );
  }
  return data;
}

export function useOptionsChain(
  symbol: string,
  conid: string,
  expiration?: string,
  maturityDate?: string,
) {
  return useQuery({
    queryKey: [
      "options-chain",
      symbol,
      conid,
      expiration ?? "default",
      maturityDate ?? "default",
    ],
    queryFn: () => fetchOptionsChain(symbol, conid, expiration, maturityDate),
    enabled: Boolean(symbol && conid),
    refetchOnWindowFocus: false,
    retry: false,
  });
}

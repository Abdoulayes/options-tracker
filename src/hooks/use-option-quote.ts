"use client";

import { useQuery } from "@tanstack/react-query";
import type { OptionQuote } from "@/hooks/use-options-chain";

// Cotation à la demande pour une échéance réelle précise (Lot 5 —
// calculateur de rendement). Contrairement à la chaîne complète, ce hook
// n'est interrogé que lorsque l'utilisateur change explicitement d'échéance
// dans le Sheet — jamais de polling.
async function fetchOptionQuote(
  conid: string,
  expiration: string,
  strike: number,
  right: "C" | "P",
  maturityDate: string,
): Promise<OptionQuote> {
  const params = new URLSearchParams({
    conid,
    expiration,
    strike: String(strike),
    right,
    maturityDate,
  });
  const response = await fetch(`/api/ibkr/option-quote?${params.toString()}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "Cotation indisponible.");
  }
  return data.quote as OptionQuote;
}

export function useOptionQuote(
  conid: string,
  expiration: string,
  strike: number,
  right: "C" | "P",
  maturityDate: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [
      "option-quote",
      conid,
      expiration,
      strike,
      right,
      maturityDate ?? "none",
    ],
    queryFn: () =>
      fetchOptionQuote(conid, expiration, strike, right, maturityDate ?? ""),
    enabled: enabled && Boolean(maturityDate),
    refetchOnWindowFocus: false,
    retry: false,
  });
}

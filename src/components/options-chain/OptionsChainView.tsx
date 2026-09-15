"use client";

import { useState } from "react";
import { useOptionsChain } from "@/hooks/use-options-chain";
import { ExpirationTabs } from "@/components/options-chain/ExpirationTabs";
import { MaturityDateTabs } from "@/components/options-chain/MaturityDateTabs";
import { OptionsChainTable } from "@/components/options-chain/OptionsChainTable";

type Props = { symbol: string; conid: string };

// Vue "Options Chain" (Lot 4, spec fonctionnelle Module 4). Les erreurs
// Gateway sont toujours affichées sous forme normalisée (message applicatif
// uniquement, jamais le détail brut renvoyé par IBKR — spec technique
// section 7).
export function OptionsChainView({ symbol, conid }: Props) {
  const [expiration, setExpiration] = useState<string | undefined>(undefined);
  // Un mois IBKR peut contenir plusieurs échéances hebdomadaires : ce state
  // affine sur la date réelle choisie par l'utilisateur au sein du mois.
  const [maturityDate, setMaturityDate] = useState<string | undefined>(
    undefined,
  );
  const { data, isLoading, isError, error, isFetching } = useOptionsChain(
    symbol,
    conid,
    expiration,
    maturityDate,
  );

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Chargement de la chaîne d&apos;options…
      </p>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error
          ? error.message
          : "Chaîne d'options indisponible."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">
          {symbol}
          {data.underlying.last !== null && (
            <span className="ml-3 text-base font-normal text-muted-foreground">
              {data.underlying.last.toFixed(2)}
            </span>
          )}
        </h1>
        {isFetching && (
          <span className="text-xs text-muted-foreground">Actualisation…</span>
        )}
      </div>

      <ExpirationTabs
        expirations={data.expirations}
        selected={expiration ?? data.selectedExpiration}
        onSelect={(newExpiration) => {
          setExpiration(newExpiration);
          // Une nouvelle échéance réelle sera proposée par le mois
          // sélectionné — on laisse le backend choisir la plus proche.
          setMaturityDate(undefined);
        }}
      />

      <MaturityDateTabs
        maturityDates={data.availableMaturityDates}
        selected={maturityDate ?? data.selectedMaturityDate ?? ""}
        onSelect={setMaturityDate}
      />

      <OptionsChainTable
        rows={data.rows}
        targetDeltaMin={data.targetDeltaMin}
        targetDeltaMax={data.targetDeltaMax}
      />
    </div>
  );
}

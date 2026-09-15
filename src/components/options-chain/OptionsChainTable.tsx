"use client";

import { cn } from "cn";
import { isDeltaInTargetZone } from "@/lib/domain-services/options-chain-calculations";
import type { OptionQuote, OptionsChainRow } from "@/hooks/use-options-chain";
import { YieldCalculatorSheet } from "@/components/calculator/YieldCalculatorSheet";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";

type Props = {
  symbol: string;
  conid: string;
  expiration: string;
  availableMaturityDates: string[];
  feePerContract: number;
  rows: OptionsChainRow[];
  targetDeltaMin: number;
  targetDeltaMax: number;
};

// Chaîne d'options au format Calls / Strike / Puts (convention TWS/IBKR —
// spec fonctionnelle Module 4). Aucun calcul de rendement (exclusion
// explicite du Lot 4) — uniquement les données de marché brutes, la
// distance % au prix actuel, et le highlight de la zone de delta cible.
export function OptionsChainTable({
  symbol,
  conid,
  expiration,
  availableMaturityDates,
  feePerContract,
  rows,
  targetDeltaMin,
  targetDeltaMax,
}: Props) {
  // Ligne ATM (strike le plus proche du prix actuel) : sert de repère visuel
  // pour délimiter la zone ITM/OTM de part et d'autre, en complément du
  // texte assombri appliqué côté OTM dans QuoteCells.
  const atmRow = rows.reduce<OptionsChainRow | null>((closest, row) => {
    if (
      closest === null ||
      Math.abs(row.distancePct) < Math.abs(closest.distancePct)
    ) {
      return row;
    }
    return closest;
  }, null);
  const atmStrike = atmRow?.strike;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-right text-sm tabular-nums">
        <thead>
          <tr className="text-muted-foreground">
            <th
              colSpan={7}
              className="border-b border-border px-2 py-1.5 text-center text-xs font-semibold tracking-wide text-foreground"
            >
              Calls (CC)
            </th>
            <th colSpan={2} className="border-b border-border" />
            <th
              colSpan={7}
              className="border-b border-border px-2 py-1.5 text-center text-xs font-semibold tracking-wide text-foreground"
            >
              Puts (CSP)
            </th>
          </tr>
          <tr className="border-b border-border text-muted-foreground">
            <QuoteHeaderCells />
            <th className="px-3 py-2 text-center font-medium">Strike</th>
            <th className="px-3 py-2 text-center font-medium">Distance</th>
            <QuoteHeaderCells />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.strike}
              className={cn(
                "border-b border-border last:border-0",
                row.strike === atmStrike &&
                  "border-t-2 border-t-primary/70 border-b-2 border-b-primary/70",
              )}
            >
              <QuoteCells
                symbol={symbol}
                conid={conid}
                expiration={expiration}
                availableMaturityDates={availableMaturityDates}
                feePerContract={feePerContract}
                strike={row.strike}
                optionType="CC"
                right="C"
                quote={row.call}
                isItm={row.distancePct < 0}
                targetDeltaMin={targetDeltaMin}
                targetDeltaMax={targetDeltaMax}
              />
              <td className="px-3 py-2 text-center font-medium text-foreground">
                {row.strike}
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-center",
                  row.distancePct >= 0
                    ? "text-emerald-500"
                    : "text-destructive",
                )}
              >
                {row.distancePct >= 0 ? "+" : ""}
                {row.distancePct.toFixed(2)}%
              </td>
              <QuoteCells
                symbol={symbol}
                conid={conid}
                expiration={expiration}
                availableMaturityDates={availableMaturityDates}
                feePerContract={feePerContract}
                strike={row.strike}
                optionType="CSP"
                right="P"
                quote={row.put}
                isItm={row.distancePct > 0}
                targetDeltaMin={targetDeltaMin}
                targetDeltaMax={targetDeltaMax}
              />
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={16}
                className="px-3 py-4 text-center text-muted-foreground"
              >
                Aucune donnée pour cette expiration.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function QuoteHeaderCells() {
  return (
    <>
      <th className="px-2 py-2 font-medium">Delta</th>
      <th className="px-2 py-2 font-medium">IV</th>
      <th className="px-2 py-2 font-medium">OI</th>
      <th className="px-2 py-2 font-medium">Vol</th>
      <th className="px-2 py-2 font-medium">Bid</th>
      <th className="px-2 py-2 font-medium">Ask</th>
      <th className="px-2 py-2 text-center font-medium">Calc.</th>
    </>
  );
}

function QuoteCells({
  symbol,
  conid,
  expiration,
  availableMaturityDates,
  feePerContract,
  strike,
  optionType,
  right,
  quote,
  isItm,
  targetDeltaMin,
  targetDeltaMax,
}: {
  symbol: string;
  conid: string;
  expiration: string;
  availableMaturityDates: string[];
  feePerContract: number;
  strike: number;
  optionType: "CSP" | "CC";
  right: "C" | "P";
  quote: OptionQuote | null;
  isItm: boolean;
  targetDeltaMin: number;
  targetDeltaMax: number;
}) {
  const inTargetZone = isDeltaInTargetZone(
    quote?.delta ?? null,
    targetDeltaMin,
    targetDeltaMax,
  );

  // Le côté OTM reste en texte plein contraste, le côté ITM est assombri —
  // ce repère est indépendant du highlight de zone de delta cible (qui joue
  // sur le fond). Les deux se cumulent volontairement : la zone delta cible
  // (0.15–0.30 par défaut) cible par construction des strikes proches de la
  // monnaie mais du côté OTM (vendre une option ITM n'a pas de sens pour un
  // CSP/CC) — un strike surligné en zone cible et assombri (ITM) n'est donc
  // pas une incohérence, c'est un cas rare (delta extrême).
  const cellClassName = cn(
    "px-2 py-2",
    inTargetZone && "bg-primary/10",
    isItm && "text-muted-foreground/70",
  );

  if (!quote) {
    return (
      <>
        <td className={cellClassName}>—</td>
        <td className={cellClassName}>—</td>
        <td className={cellClassName}>—</td>
        <td className={cellClassName}>—</td>
        <td className={cellClassName}>—</td>
        <td className={cellClassName}>—</td>
        <td className={cellClassName}></td>
      </>
    );
  }

  return (
    <>
      <td
        className={cn(
          cellClassName,
          // `!` (important) garantit que la couleur de la zone cible gagne
          // sur l'assombrissement OTM, indépendamment de l'ordre de
          // résolution des classes Tailwind.
          inTargetZone && "font-semibold !text-primary",
        )}
      >
        {quote.delta?.toFixed(2) ?? "—"}
      </td>
      <td className={cellClassName}>
        {quote.impliedVolatility !== null
          ? `${quote.impliedVolatility.toFixed(1)}%`
          : "—"}
      </td>
      <td className={cellClassName}>{quote.openInterest ?? "—"}</td>
      <td className={cellClassName}>{quote.volume ?? "—"}</td>
      <td className={cellClassName}>{quote.bid?.toFixed(2) ?? "—"}</td>
      <td className={cellClassName}>{quote.ask?.toFixed(2) ?? "—"}</td>
      <td className={cn(cellClassName, "text-center")}>
        {quote.bid !== null && (
          <YieldCalculatorSheet
            symbol={symbol}
            conid={conid}
            expiration={expiration}
            optionType={optionType}
            right={right}
            strike={strike}
            initialQuote={{
              maturityDate: quote.maturityDate,
              bid: quote.bid,
              ask: quote.ask,
              delta: quote.delta,
            }}
            availableMaturityDates={availableMaturityDates}
            feePerContract={feePerContract}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Calculer le rendement"
              >
                <Calculator />
              </Button>
            }
          />
        )}
      </td>
    </>
  );
}

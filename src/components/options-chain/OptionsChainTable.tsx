"use client";

import { cn } from "cn";
import { isDeltaInTargetZone } from "@/lib/domain-services/options-chain-calculations";
import type { OptionQuote, OptionsChainRow } from "@/hooks/use-options-chain";

type Props = {
  rows: OptionsChainRow[];
  targetDeltaMin: number;
  targetDeltaMax: number;
};

// Chaîne d'options au format traditionnel Puts / Strike / Calls (spec
// fonctionnelle Module 4). Aucun calcul de rendement (exclusion explicite
// du Lot 4) — uniquement les données de marché brutes, la distance % au
// prix actuel, et le highlight de la zone de delta cible.
export function OptionsChainTable({
  rows,
  targetDeltaMin,
  targetDeltaMax,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-right text-sm tabular-nums">
        <thead>
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
              className="border-b border-border last:border-0"
            >
              <QuoteCells
                quote={row.put}
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
                quote={row.call}
                targetDeltaMin={targetDeltaMin}
                targetDeltaMax={targetDeltaMax}
              />
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={12}
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
    </>
  );
}

function QuoteCells({
  quote,
  targetDeltaMin,
  targetDeltaMax,
}: {
  quote: OptionQuote | null;
  targetDeltaMin: number;
  targetDeltaMax: number;
}) {
  const inTargetZone = isDeltaInTargetZone(
    quote?.delta ?? null,
    targetDeltaMin,
    targetDeltaMax,
  );

  const cellClassName = cn("px-2 py-2", inTargetZone && "bg-primary/10");

  if (!quote) {
    return (
      <>
        <td className={cellClassName}>—</td>
        <td className={cellClassName}>—</td>
        <td className={cellClassName}>—</td>
        <td className={cellClassName}>—</td>
        <td className={cellClassName}>—</td>
        <td className={cellClassName}>—</td>
      </>
    );
  }

  return (
    <>
      <td
        className={cn(
          cellClassName,
          inTargetZone && "font-semibold text-primary",
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
    </>
  );
}

"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import {
  calculateYield,
  type OptionStrategyType,
} from "@/lib/domain-services/yield-calculator";
import { useOptionQuote } from "@/hooks/use-option-quote";
import { estimateDte, formatMaturityDate } from "@/lib/ui/estimate-dte";
import { ProfitLossChart } from "@/components/calculator/ProfitLossChart";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InitialQuote = {
  maturityDate: string;
  bid: number | null;
  ask: number | null;
  delta: number | null;
};

type Props = {
  trigger: ReactElement;
  symbol: string;
  optionType: OptionStrategyType;
  right: "C" | "P";
  conid: string;
  expiration: string;
  strike: number;
  initialQuote: InitialQuote;
  availableMaturityDates: string[];
  feePerContract: number;
};

function formatCurrency(value: number): string {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "USD",
  });
}

function formatPct(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${value.toFixed(2)} %`;
}

// Sheet panel du calculateur de rendement CSP/CC (Lot 5, spec fonctionnelle
// Module 5). Seul le nombre de contrats est une hypothèse libre : l'échéance
// se choisit parmi les vraies dates disponibles (une cotation réelle est
// récupérée à la demande si ce n'est pas celle déjà chargée dans le
// tableau), la prime est bornée au Bid/Ask réel de cette échéance, et les
// frais reflètent le réglage du compte (non éditables ici — cf. Lot 7 pour
// leur configuration).
export function YieldCalculatorSheet({
  trigger,
  symbol,
  optionType,
  right,
  conid,
  expiration,
  strike,
  initialQuote,
  availableMaturityDates,
  feePerContract,
}: Props) {
  const [contracts, setContracts] = useState(1);
  const [selectedMaturityDate, setSelectedMaturityDate] = useState(
    initialQuote.maturityDate,
  );
  const isInitialDate = selectedMaturityDate === initialQuote.maturityDate;

  const quoteQuery = useOptionQuote(
    conid,
    expiration,
    strike,
    right,
    selectedMaturityDate,
    !isInitialDate,
  );

  const activeQuote = isInitialDate ? initialQuote : (quoteQuery.data ?? null);
  const isLoadingQuote = !isInitialDate && quoteQuery.isLoading;
  const quoteError =
    !isInitialDate && quoteQuery.isError
      ? quoteQuery.error instanceof Error
        ? quoteQuery.error.message
        : "Cotation indisponible pour cette échéance."
      : null;

  return (
    <Sheet>
      <SheetTrigger render={trigger} />
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {symbol} {strike} {optionType}
          </SheetTitle>
          <SheetDescription>
            Calculateur de rendement — échéance et prime réelles, contrats
            ajustables.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="calc-maturity">Échéance</Label>
            <select
              id="calc-maturity"
              value={selectedMaturityDate}
              onChange={(event) => setSelectedMaturityDate(event.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {availableMaturityDates.map((date) => (
                <option key={date} value={date} className="text-foreground">
                  {formatMaturityDate(date)} ({estimateDte(date)} j)
                </option>
              ))}
            </select>
          </div>

          {isLoadingQuote && (
            <p className="text-sm text-muted-foreground">
              Chargement de la cotation pour cette échéance…
            </p>
          )}
          {quoteError && (
            <p className="text-sm text-destructive">{quoteError}</p>
          )}

          {activeQuote && (
            <CalculatorResults
              // Remonte le calculateur à chaque nouvelle cotation chargée :
              // la prime éditable doit repartir du Bid de CETTE cotation,
              // jamais d'un reliquat de l'échéance précédente.
              key={`${activeQuote.maturityDate}-${activeQuote.bid}`}
              optionType={optionType}
              strike={strike}
              contracts={contracts}
              onContractsChange={setContracts}
              feePerContract={feePerContract}
              quote={activeQuote}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CalculatorResults({
  optionType,
  strike,
  contracts,
  onContractsChange,
  feePerContract,
  quote,
}: {
  optionType: OptionStrategyType;
  strike: number;
  contracts: number;
  onContractsChange: (contracts: number) => void;
  feePerContract: number;
  quote: InitialQuote;
}) {
  const [premium, setPremium] = useState(quote.bid ?? 0);
  const bidBound = quote.bid ?? 0;
  const askBound = quote.ask ?? undefined;

  function handlePremiumChange(rawValue: number) {
    const upperBound = askBound ?? Infinity;
    setPremium(Math.min(Math.max(rawValue, bidBound), upperBound));
  }

  const dte = estimateDte(quote.maturityDate);
  const result = calculateYield({
    optionType,
    strike,
    premiumPerShare: premium,
    dte,
    contracts,
    feePerContract,
    delta: quote.delta,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="calc-premium">Prime / action</Label>
          <Input
            id="calc-premium"
            type="number"
            step="0.01"
            min={bidBound}
            max={askBound}
            value={premium}
            onChange={(event) =>
              handlePremiumChange(Number(event.target.value))
            }
          />
          <p className="text-xs text-muted-foreground">
            Bid {quote.bid?.toFixed(2) ?? "—"} – Ask{" "}
            {quote.ask?.toFixed(2) ?? "—"}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="calc-contracts">Contrats</Label>
          <Input
            id="calc-contracts"
            type="number"
            step="1"
            min="1"
            value={contracts}
            onChange={(event) =>
              onContractsChange(Math.max(1, Number(event.target.value)))
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label>Frais / contrat</Label>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(feePerContract)} — réglage du compte, non modifiable
          ici.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-border p-3 text-sm">
        <MetricRow label="Prime totale perçue">
          {formatCurrency(result.totalPremium)}
        </MetricRow>
        <MetricRow label="Collatéral requis">
          {formatCurrency(result.collateralRequired)}
        </MetricRow>
        <MetricRow label="Rendement brut">
          {formatPct(result.grossYieldPct)}
        </MetricRow>
        <MetricRow label="Rendement annualisé">
          {formatPct(result.grossAnnualizedYieldPct)}
        </MetricRow>
        <MetricRow label="Frais totaux">
          {formatCurrency(result.totalFees)}
        </MetricRow>
        <MetricRow label="Rendement net (frais)">
          {formatPct(result.netYieldPct)}
        </MetricRow>
        <MetricRow label="Rendement net annualisé">
          {formatPct(result.netAnnualizedYieldPct)}
        </MetricRow>
        <MetricRow label="Break-even">
          {formatCurrency(result.breakeven)}
        </MetricRow>
        <MetricRow label="Probabilité ITM (approx.)">
          {formatPct(result.probabilityItmPct)}
        </MetricRow>
        <MetricRow label="Profit maximum" valueClassName="text-emerald-500">
          {formatCurrency(result.maxProfit)}
        </MetricRow>
        <MetricRow label="Perte maximum" valueClassName="text-destructive">
          {formatCurrency(-result.maxLoss)}
        </MetricRow>
      </dl>

      <ProfitLossChart
        strike={strike}
        breakeven={result.breakeven}
        maxProfit={result.maxProfit}
        maxLoss={result.maxLoss}
      />
    </div>
  );
}

function MetricRow({
  label,
  children,
  valueClassName,
}: {
  label: string;
  children: ReactNode;
  valueClassName?: string;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`text-right font-medium text-foreground ${valueClassName ?? ""}`}
      >
        {children}
      </dd>
    </>
  );
}

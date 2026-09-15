"use client";

import { cn } from "cn";

type Props = {
  maturityDates: string[]; // YYYYMMDD
  selected: string;
  onSelect: (maturityDate: string) => void;
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatMaturityDate(yyyymmdd: string): string {
  const year = Number(yyyymmdd.slice(0, 4));
  const month = Number(yyyymmdd.slice(4, 6)) - 1;
  const day = Number(yyyymmdd.slice(6, 8));
  return dateFormatter.format(new Date(Date.UTC(year, month, day)));
}

// Sélecteur d'échéance réelle au sein d'un mois IBKR (options
// hebdomadaires) — n'apparaît que lorsque le mois sélectionné contient
// plusieurs vendredis d'expiration distincts. Cf. le commentaire sur
// getOptionsChain dans options-chain-service.ts pour le pourquoi.
export function MaturityDateTabs({ maturityDates, selected, onSelect }: Props) {
  if (maturityDates.length <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      <span className="self-center pr-1 text-xs text-muted-foreground">
        Échéance :
      </span>
      {maturityDates.map((maturityDate) => (
        <button
          key={maturityDate}
          type="button"
          onClick={() => onSelect(maturityDate)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            maturityDate === selected
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {formatMaturityDate(maturityDate)}
        </button>
      ))}
    </div>
  );
}

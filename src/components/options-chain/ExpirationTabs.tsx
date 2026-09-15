"use client";

import { cn } from "cn";

type Props = {
  expirations: string[];
  selected: string;
  onSelect: (expiration: string) => void;
};

// Tabs de sélection d'expiration (spec fonctionnelle Module 4). Changer de
// tab ne recharge pas la page — géré côté client par le composant parent.
export function ExpirationTabs({ expirations, selected, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border pb-2">
      {expirations.map((expiration) => (
        <button
          key={expiration}
          type="button"
          onClick={() => onSelect(expiration)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            expiration === selected
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {expiration}
        </button>
      ))}
    </div>
  );
}

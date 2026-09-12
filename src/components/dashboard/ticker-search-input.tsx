"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";

export type TickerSearchResult = {
  conid: string;
  symbol: string;
  description: string;
};

type Props = {
  onSelect: (result: TickerSearchResult) => void;
};

// Recherche de ticker avec autocomplete, résolue via /api/ibkr/ticker-search
// (jamais d'appel direct au Gateway depuis le navigateur — spec technique
// section 2.3).
export function TickerSearchInput({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TickerSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const trimmedQuery = query.trim();
  const isOpen = !dismissed && trimmedQuery.length > 0;

  useEffect(() => {
    if (trimmedQuery.length < 1) {
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/ibkr/ticker-search?q=${encodeURIComponent(trimmedQuery)}`,
        );
        const data = await response.json();
        if (!cancelled) {
          setResults(response.ok ? data.results : []);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setDismissed(false);
        }}
        placeholder="Rechercher un symbole (ex : AAPL)"
        className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        autoComplete="off"
      />
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          {isLoading && (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              Recherche…
            </p>
          )}
          {!isLoading && results.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              Aucun résultat.
            </p>
          )}
          {!isLoading &&
            results.map((result) => (
              <button
                key={result.conid}
                type="button"
                onClick={() => {
                  onSelect(result);
                  setQuery("");
                  setResults([]);
                  setDismissed(true);
                }}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                )}
              >
                <span className="font-medium text-foreground">
                  {result.symbol}
                </span>
                {result.description && (
                  <span className="text-xs text-muted-foreground">
                    {result.description}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

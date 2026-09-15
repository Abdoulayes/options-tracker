"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  TickerSearchInput,
  type TickerSearchResult,
} from "@/components/dashboard/ticker-search-input";
import {
  useAddTicker,
  useImportCsv,
  useRemoveTicker,
  useUpdateTicker,
  useWatchlistDetail,
  type WatchlistTicker,
} from "@/hooks/use-watchlist-detail";

const TAGS = ["CORE", "GROWTH", "SPECULATIVE", "BLACKLIST"] as const;

type Props = { watchlistId: string };

export function WatchlistDetail({ watchlistId }: Props) {
  const {
    data: watchlist,
    isLoading,
    isError,
  } = useWatchlistDetail(watchlistId);
  const addTicker = useAddTicker(watchlistId);
  const importCsv = useImportCsv(watchlistId);
  const [selected, setSelected] = useState<TickerSearchResult | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }
  if (isError || !watchlist) {
    return <p className="text-sm text-destructive">Watchlist introuvable.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">
        {watchlist.name}
      </h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Ajouter un ticker
        </h2>
        <div className="flex max-w-md flex-col gap-2">
          <TickerSearchInput
            onSelect={(result) => {
              setSelected(result);
              setAddError(null);
            }}
          />
          {selected && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <span className="font-medium">{selected.symbol}</span>
              <span className="text-muted-foreground">
                {selected.description}
              </span>
              <Button
                type="button"
                size="sm"
                className="ml-auto"
                disabled={addTicker.isPending}
                onClick={() => {
                  addTicker.mutate(
                    { symbol: selected.symbol, conid: selected.conid },
                    {
                      onSuccess: () => setSelected(null),
                      onError: (error) => setAddError(error.message),
                    },
                  );
                }}
              >
                Ajouter à la watchlist
              </Button>
            </div>
          )}
          {addError && <p className="text-sm text-destructive">{addError}</p>}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Tickers ({watchlist.tickers.length})
          </h2>
          <div className="flex gap-2">
            <a
              href={`/api/watchlists/${watchlistId}/tickers/export`}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Exporter en CSV
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importCsv.isPending}
            >
              Importer un CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const text = await file.text();
                importCsv.mutate(text);
              }}
            />
          </div>
        </div>

        {importCsv.isError && (
          <p className="text-sm text-destructive">{importCsv.error.message}</p>
        )}
        {importCsv.data && (
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <p>{importCsv.data.added.length} ticker(s) ajouté(s).</p>
            {importCsv.data.skippedDuplicates.length > 0 && (
              <p className="text-muted-foreground">
                Doublons ignorés : {importCsv.data.skippedDuplicates.join(", ")}
              </p>
            )}
            {importCsv.data.invalid.length > 0 && (
              <p className="text-destructive">
                {importCsv.data.invalid.length} ligne(s) invalide(s) :{" "}
                {importCsv.data.invalid
                  .map((i) => `L${i.line} (${i.error})`)
                  .join(", ")}
              </p>
            )}
          </div>
        )}

        <TickersTable watchlistId={watchlistId} tickers={watchlist.tickers} />
      </section>
    </div>
  );
}

function TickersTable({
  watchlistId,
  tickers,
}: {
  watchlistId: string;
  tickers: WatchlistTicker[];
}) {
  const updateTicker = useUpdateTicker(watchlistId);
  const removeTicker = useRemoveTicker(watchlistId);

  if (tickers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun ticker dans cette watchlist.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Symbole</th>
            <th className="px-3 py-2 font-medium">Tag</th>
            <th className="px-3 py-2 font-medium">Notes</th>
            <th className="px-3 py-2 font-medium">Prix cible</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {tickers.map((ticker) => (
            <tr
              key={ticker.id}
              className="border-b border-border last:border-0"
            >
              <td className="px-3 py-2 font-medium text-foreground">
                {ticker.symbol}
              </td>
              <td className="px-3 py-2">
                <select
                  value={ticker.tag ?? ""}
                  onChange={(event) =>
                    updateTicker.mutate({
                      tickerId: ticker.id,
                      input: {
                        tag: (event.target.value || null) as
                          WatchlistTicker["tag"] | null,
                      },
                    })
                  }
                  className="h-7 rounded-md border border-border bg-background px-1.5 text-xs text-foreground"
                >
                  <option value="">—</option>
                  {TAGS.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  defaultValue={ticker.notes ?? ""}
                  onBlur={(event) => {
                    const value = event.target.value;
                    if (value === (ticker.notes ?? "")) return;
                    updateTicker.mutate({
                      tickerId: ticker.id,
                      input: { notes: value || null },
                    });
                  }}
                  className="h-7 w-full rounded-md border border-border bg-background px-1.5 text-xs text-foreground"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={ticker.targetPrice ?? ""}
                  onBlur={(event) => {
                    const value = event.target.value;
                    const numeric = value === "" ? null : Number(value);
                    if (
                      (numeric ?? null) ===
                      (ticker.targetPrice ? Number(ticker.targetPrice) : null)
                    ) {
                      return;
                    }
                    updateTicker.mutate({
                      tickerId: ticker.id,
                      input: { targetPrice: numeric },
                    });
                  }}
                  className="h-7 w-24 rounded-md border border-border bg-background px-1.5 text-xs text-foreground"
                />
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-2">
                  {ticker.conid && (
                    <Link
                      href={`/options-chain?symbol=${ticker.symbol}&conid=${ticker.conid}`}
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      Options
                    </Link>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="xs"
                    disabled={removeTicker.isPending}
                    onClick={() => removeTicker.mutate(ticker.id)}
                  >
                    Retirer
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

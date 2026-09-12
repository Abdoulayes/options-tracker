"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  useCreateWatchlist,
  useDeleteWatchlist,
  useWatchlists,
} from "@/hooks/use-watchlists";

// Création/suppression de watchlist — Module 3 de la spec fonctionnelle.
export function WatchlistsList() {
  const { data: watchlists, isLoading, isError } = useWatchlists();
  const createWatchlist = useCreateWatchlist();
  const deleteWatchlist = useDeleteWatchlist();
  const [name, setName] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          createWatchlist.mutate(trimmed, {
            onSuccess: () => setName(""),
          });
        }}
        className="flex items-end gap-2"
      >
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nom de la nouvelle watchlist"
          className="h-8 w-64 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" disabled={createWatchlist.isPending}>
          Créer
        </Button>
      </form>

      {createWatchlist.isError && (
        <p className="text-sm text-destructive">
          {createWatchlist.error.message}
        </p>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          Impossible de charger les watchlists.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {watchlists?.map((watchlist) => (
          <li
            key={watchlist.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
          >
            <Link
              href={`/watchlists/${watchlist.id}`}
              className="text-sm font-medium text-foreground hover:underline"
            >
              {watchlist.name}
              <span className="ml-2 text-xs text-muted-foreground">
                {watchlist._count.tickers} ticker(s)
              </span>
            </Link>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteWatchlist.isPending}
              onClick={() => {
                if (confirm(`Supprimer la watchlist "${watchlist.name}" ?`)) {
                  deleteWatchlist.mutate(watchlist.id);
                }
              }}
            >
              Supprimer
            </Button>
          </li>
        ))}
        {watchlists?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucune watchlist pour le moment.
          </p>
        )}
      </ul>
    </div>
  );
}

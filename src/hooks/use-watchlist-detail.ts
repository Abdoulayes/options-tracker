"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type WatchlistTicker = {
  id: string;
  symbol: string;
  conid: string | null;
  tag: "CORE" | "GROWTH" | "SPECULATIVE" | "BLACKLIST" | null;
  notes: string | null;
  targetPrice: string | null;
};

export type WatchlistDetail = {
  id: string;
  name: string;
  tickers: WatchlistTicker[];
};

export type NewTickerInput = {
  symbol: string;
  conid?: string | null;
  tag?: WatchlistTicker["tag"] | null;
  notes?: string | null;
  targetPrice?: number | null;
};

export type UpdateTickerInput = {
  tag?: WatchlistTicker["tag"] | null;
  notes?: string | null;
  targetPrice?: number | null;
};

export type ImportSummary = {
  added: string[];
  skippedDuplicates: string[];
  invalid: { line: number; error: string }[];
};

function detailKey(id: string) {
  return ["watchlist", id] as const;
}

async function fetchWatchlist(id: string): Promise<WatchlistDetail> {
  const response = await fetch(`/api/watchlists/${id}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Watchlist introuvable.");
  }
  return data.watchlist;
}

export function useWatchlistDetail(id: string) {
  return useQuery({
    queryKey: detailKey(id),
    queryFn: () => fetchWatchlist(id),
  });
}

export function useAddTicker(watchlistId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewTickerInput) => {
      const response = await fetch(`/api/watchlists/${watchlistId}/tickers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Ajout impossible.");
      }
      return data.ticker;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey(watchlistId) });
    },
  });
}

export function useUpdateTicker(watchlistId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tickerId,
      input,
    }: {
      tickerId: string;
      input: UpdateTickerInput;
    }) => {
      const response = await fetch(
        `/api/watchlists/${watchlistId}/tickers/${tickerId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Mise à jour impossible.");
      }
      return data.ticker;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey(watchlistId) });
    },
  });
}

export function useRemoveTicker(watchlistId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tickerId: string) => {
      const response = await fetch(
        `/api/watchlists/${watchlistId}/tickers/${tickerId}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Suppression impossible.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey(watchlistId) });
    },
  });
}

export function useImportCsv(watchlistId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (csvText: string): Promise<ImportSummary> => {
      const response = await fetch(
        `/api/watchlists/${watchlistId}/tickers/import`,
        {
          method: "POST",
          headers: { "Content-Type": "text/csv" },
          body: csvText,
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Import impossible.");
      }
      return data.summary;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey(watchlistId) });
    },
  });
}

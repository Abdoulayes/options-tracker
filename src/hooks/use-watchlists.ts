"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type WatchlistSummary = {
  id: string;
  name: string;
  createdAt: string;
  _count: { tickers: number };
};

async function fetchWatchlists(): Promise<WatchlistSummary[]> {
  const response = await fetch("/api/watchlists");
  if (!response.ok) {
    throw new Error("Impossible de récupérer les watchlists.");
  }
  const data = await response.json();
  return data.watchlists;
}

export function useWatchlists() {
  return useQuery({
    queryKey: ["watchlists"],
    queryFn: fetchWatchlists,
  });
}

export function useCreateWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Création impossible.");
      }
      return data.watchlist;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["watchlists"] });
    },
  });
}

export function useDeleteWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/watchlists/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Suppression impossible.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["watchlists"] });
    },
  });
}

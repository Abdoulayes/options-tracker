import { WatchlistsList } from "@/components/dashboard/watchlists-list";

// Gestion des watchlists (Lot 3, Module 3 de la spec fonctionnelle).
// La protection de route est assurée par le proxy applicatif (groupe
// (dashboard), cf. CLAUDE.md) ; les données sont chargées côté client via
// TanStack Query, cohérent avec le badge de statut Gateway du Lot 2.
export default function WatchlistsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="text-xl font-semibold text-foreground">Watchlists</h1>
      <WatchlistsList />
    </main>
  );
}

// Page d'accueil minimale du Lot 0 — aucune logique métier, sert uniquement
// à valider le squelette du projet (thème sombre, Tailwind, alias @/).
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-background px-6 text-center text-foreground">
      <h1 className="text-3xl font-semibold tracking-tight">
        Wheel Strategy Watchlist Tool
      </h1>
      <p className="text-muted-foreground">
        Squelette du projet — Lot 0 en place.
      </p>
    </main>
  );
}

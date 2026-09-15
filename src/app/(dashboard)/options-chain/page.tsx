import { OptionsChainView } from "@/components/options-chain/OptionsChainView";

// Page Options Chain (Lot 4) — accédée depuis une watchlist via
// `?symbol=...&conid=...` (le conid est déjà résolu lors de l'ajout du
// ticker à la watchlist, cf. Lot 3).
export default async function OptionsChainPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; conid?: string }>;
}) {
  const { symbol, conid } = await searchParams;

  if (!symbol || !conid) {
    return (
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <p className="text-sm text-destructive">
          Ticker manquant : accédez à la chaîne d&apos;options depuis une
          watchlist.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <OptionsChainView symbol={symbol} conid={conid} />
    </main>
  );
}

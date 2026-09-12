import { WatchlistDetail } from "@/components/dashboard/watchlist-detail";

export default async function WatchlistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <WatchlistDetail watchlistId={id} />
    </main>
  );
}

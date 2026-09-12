import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { buildWatchlistCsv } from "@/lib/watchlists/csv";
import { getWatchlistWithTickers } from "@/lib/watchlists/watchlist-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.twoFactorVerified) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const { id } = await params;
  const watchlist = await getWatchlistWithTickers(session.user.id, id);
  if (!watchlist) {
    return NextResponse.json(
      { error: "Watchlist introuvable." },
      { status: 404 },
    );
  }

  const csv = buildWatchlistCsv(
    watchlist.tickers.map((ticker) => ({
      symbol: ticker.symbol,
      tag: ticker.tag,
      notes: ticker.notes,
      targetPrice: ticker.targetPrice?.toString() ?? null,
    })),
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${watchlist.name.replace(/[^a-z0-9-_]+/gi, "_")}.csv"`,
    },
  });
}

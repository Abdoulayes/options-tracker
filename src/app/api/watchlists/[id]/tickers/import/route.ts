import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { parseWatchlistCsv } from "@/lib/watchlists/csv";
import {
  importTickers,
  WatchlistNotFoundError,
} from "@/lib/watchlists/watchlist-service";

type RouteContext = { params: Promise<{ id: string }> };

// Import CSV en masse — colonnes attendues : symbol,tag,notes,targetPrice
// (en-tête optionnel). Les doublons vis-à-vis de la watchlist existante
// sont ignorés individuellement plutôt que de faire échouer tout l'import
// (critère d'acceptation du Lot 3).
export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.twoFactorVerified) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const csvText = await request.text();
  if (!csvText.trim()) {
    return NextResponse.json({ error: "Fichier CSV vide." }, { status: 400 });
  }

  const { rows } = parseWatchlistCsv(csvText);
  const { id } = await params;

  try {
    const summary = await importTickers(session.user.id, id, rows);
    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof WatchlistNotFoundError) {
      return NextResponse.json(
        { error: "Watchlist introuvable." },
        { status: 404 },
      );
    }
    throw error;
  }
}

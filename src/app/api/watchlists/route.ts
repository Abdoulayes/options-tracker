import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { createWatchlistSchema } from "@/lib/validation-schemas/watchlist-schemas";
import {
  createWatchlist,
  listWatchlists,
} from "@/lib/watchlists/watchlist-service";

// CRUD watchlist — spec technique section 7 ("Watchlist : CRUD watchlist,
// ajout/suppression de ticker", session complète requise).
export async function GET() {
  const session = await auth();
  if (!session?.twoFactorVerified) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const watchlists = await listWatchlists(session.user.id);
  return NextResponse.json({ watchlists });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.twoFactorVerified) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createWatchlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 },
    );
  }

  const watchlist = await createWatchlist(session.user.id, parsed.data.name);
  return NextResponse.json({ watchlist }, { status: 201 });
}

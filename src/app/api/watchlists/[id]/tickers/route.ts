import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { createTickerSchema } from "@/lib/validation-schemas/watchlist-schemas";
import {
  addTicker,
  DuplicateTickerError,
  WatchlistNotFoundError,
} from "@/lib/watchlists/watchlist-service";

type RouteContext = { params: Promise<{ id: string }> };

// Ajout d'un ticker à une watchlist — la contrainte d'unicité
// (watchlistId, symbol) est respectée au niveau du schéma Prisma ; un
// doublon est rejeté avec un message explicite (critère d'acceptation du
// Lot 3).
export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.twoFactorVerified) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createTickerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 },
    );
  }

  const { id } = await params;
  try {
    const ticker = await addTicker(session.user.id, id, parsed.data);
    return NextResponse.json({ ticker }, { status: 201 });
  } catch (error) {
    if (error instanceof WatchlistNotFoundError) {
      return NextResponse.json(
        { error: "Watchlist introuvable." },
        { status: 404 },
      );
    }
    if (error instanceof DuplicateTickerError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

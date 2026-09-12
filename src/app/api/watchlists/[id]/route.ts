import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { updateWatchlistSchema } from "@/lib/validation-schemas/watchlist-schemas";
import {
  deleteWatchlist,
  getWatchlistWithTickers,
  renameWatchlist,
  WatchlistNotFoundError,
} from "@/lib/watchlists/watchlist-service";

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

  return NextResponse.json({ watchlist });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.twoFactorVerified) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateWatchlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 },
    );
  }

  const { id } = await params;
  try {
    const watchlist = await renameWatchlist(
      session.user.id,
      id,
      parsed.data.name,
    );
    return NextResponse.json({ watchlist });
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

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.twoFactorVerified) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const { id } = await params;
  try {
    await deleteWatchlist(session.user.id, id);
    return NextResponse.json({ success: true });
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

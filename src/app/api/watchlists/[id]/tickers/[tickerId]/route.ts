import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { updateTickerSchema } from "@/lib/validation-schemas/watchlist-schemas";
import {
  removeTicker,
  updateTicker,
  WatchlistNotFoundError,
} from "@/lib/watchlists/watchlist-service";

type RouteContext = { params: Promise<{ id: string; tickerId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.twoFactorVerified) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateTickerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 },
    );
  }

  const { id, tickerId } = await params;
  try {
    const ticker = await updateTicker(
      session.user.id,
      id,
      tickerId,
      parsed.data,
    );
    return NextResponse.json({ ticker });
  } catch (error) {
    if (error instanceof WatchlistNotFoundError) {
      return NextResponse.json(
        { error: "Ticker introuvable." },
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

  const { id, tickerId } = await params;
  try {
    await removeTicker(session.user.id, id, tickerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof WatchlistNotFoundError) {
      return NextResponse.json(
        { error: "Ticker introuvable." },
        { status: 404 },
      );
    }
    throw error;
  }
}

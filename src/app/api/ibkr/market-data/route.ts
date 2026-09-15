import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { MARKET_DATA_FIELD_IDS } from "@/lib/ibkr-gateway/client";
import { fetchMarketDataSnapshot } from "@/lib/market-data/snapshot";
import { marketDataQuerySchema } from "@/lib/validation-schemas/market-data-schemas";

// Snapshot de marché du sous-jacent (Lot 4, spec fonctionnelle Module 4,
// spec technique section 7). Utilisé pour le prix courant affiché au
// dessus de la chaîne d'options.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.twoFactorVerified) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const parsed = marketDataQuerySchema.safeParse({
    conid: searchParams.get("conid") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Paramètres invalides." },
      { status: 400 },
    );
  }

  const result = await fetchMarketDataSnapshot(
    [parsed.data.conid],
    [
      MARKET_DATA_FIELD_IDS.last,
      MARKET_DATA_FIELD_IDS.bid,
      MARKET_DATA_FIELD_IDS.ask,
    ],
  );

  if (!result.ok) {
    // Erreur normalisée — jamais le corps brut de l'erreur Gateway
    // (spec technique section 7).
    return NextResponse.json(
      { error: result.error.kind, message: result.error.message },
      { status: 502 },
    );
  }

  const snapshot = result.data[0];
  return NextResponse.json({
    conid: Number(parsed.data.conid),
    last: snapshot?.[MARKET_DATA_FIELD_IDS.last]
      ? Number(snapshot[MARKET_DATA_FIELD_IDS.last])
      : null,
    bid: snapshot?.[MARKET_DATA_FIELD_IDS.bid]
      ? Number(snapshot[MARKET_DATA_FIELD_IDS.bid])
      : null,
    ask: snapshot?.[MARKET_DATA_FIELD_IDS.ask]
      ? Number(snapshot[MARKET_DATA_FIELD_IDS.ask])
      : null,
  });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { searchTicker } from "@/lib/ibkr-gateway/client";

// Recherche de ticker avec autocomplete — spec fonctionnelle Module 3,
// spec technique section 7. Résout uniquement le symbole/conid ; aucune
// donnée de marché (exclusion explicite du Lot 3).
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.twoFactorVerified) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const result = await searchTicker(query);
  if (!result.ok) {
    // Erreur normalisée — jamais le corps brut de l'erreur Gateway
    // (spec technique section 7).
    return NextResponse.json(
      { error: result.error.kind, message: result.error.message },
      { status: 502 },
    );
  }

  const results = result.data
    .filter((entry) => entry.sections?.some((s) => s.secType === "STK") ?? true)
    .map((entry) => ({
      conid: entry.conid,
      symbol: entry.symbol,
      description: entry.companyHeader ?? entry.companyName ?? "",
    }));

  return NextResponse.json({ results });
}

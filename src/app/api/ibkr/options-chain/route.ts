import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import {
  getOptionsChain,
  listExpirations,
} from "@/lib/market-data/options-chain-service";
import { getOrCreateUserSettings } from "@/lib/settings/settings-service";
import { optionsChainQuerySchema } from "@/lib/validation-schemas/market-data-schemas";

// Chaîne d'options (format traditionnel Puts/Strike/Calls) pour un ticker
// donné (Lot 4, spec fonctionnelle Module 4, spec technique sections 6-7).
// Aucun calcul de rendement ici (exclusion explicite du Lot 4, réservé au
// Lot 5) — seules les données brutes de marché et la zone de delta cible
// (lue depuis UserSettings) sont renvoyées.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.twoFactorVerified) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const parsed = optionsChainQuerySchema.safeParse({
    symbol: searchParams.get("symbol") ?? "",
    conid: searchParams.get("conid") ?? "",
    expiration: searchParams.get("expiration") ?? undefined,
    maturityDate: searchParams.get("maturityDate") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Paramètres invalides." },
      { status: 400 },
    );
  }

  const { symbol, conid } = parsed.data;

  const expirationsResult = await listExpirations(symbol, conid);
  if (!expirationsResult.ok) {
    if ("notFound" in expirationsResult) {
      return NextResponse.json(
        {
          error: "no_options",
          message: "Aucune option disponible pour ce ticker.",
        },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        error: expirationsResult.error.kind,
        message: expirationsResult.error.message,
      },
      { status: 502 },
    );
  }

  const expirations = expirationsResult.expirations;
  const selectedExpiration = parsed.data.expiration ?? expirations[0];
  if (!selectedExpiration) {
    return NextResponse.json(
      {
        error: "no_options",
        message: "Aucune option disponible pour ce ticker.",
      },
      { status: 404 },
    );
  }

  const [chainResult, settings] = await Promise.all([
    getOptionsChain(conid, selectedExpiration, parsed.data.maturityDate),
    getOrCreateUserSettings(session.user.id),
  ]);

  if (!chainResult.ok) {
    // Erreur normalisée — jamais le corps brut de l'erreur Gateway
    // (spec technique section 7).
    return NextResponse.json(
      { error: chainResult.error.kind, message: chainResult.error.message },
      { status: 502 },
    );
  }

  return NextResponse.json({
    expirations,
    selectedExpiration,
    availableMaturityDates: chainResult.availableMaturityDates,
    selectedMaturityDate: chainResult.selectedMaturityDate,
    underlying: chainResult.underlying,
    rows: chainResult.rows,
    targetDeltaMin: Number(settings.targetDeltaMin),
    targetDeltaMax: Number(settings.targetDeltaMax),
    feePerContract: Number(settings.feePerContract),
  });
}

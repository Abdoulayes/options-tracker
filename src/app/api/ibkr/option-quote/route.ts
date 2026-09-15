import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { getOptionQuoteForDate } from "@/lib/market-data/options-chain-service";
import { optionQuoteQuerySchema } from "@/lib/validation-schemas/market-data-schemas";

// Cotation d'un contrat pour une échéance réelle précise (Lot 5 — le
// calculateur de rendement change d'échéance via un vrai contrat, jamais un
// DTE inventé). Distinct de /api/ibkr/options-chain : un seul strike/côté,
// interrogé à la demande quand l'utilisateur change de date dans le Sheet.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.twoFactorVerified) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const parsed = optionQuoteQuerySchema.safeParse({
    conid: searchParams.get("conid") ?? "",
    expiration: searchParams.get("expiration") ?? "",
    strike: searchParams.get("strike") ?? "",
    right: searchParams.get("right") ?? "",
    maturityDate: searchParams.get("maturityDate") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Paramètres invalides." },
      { status: 400 },
    );
  }

  const { conid, expiration, strike, right, maturityDate } = parsed.data;

  const result = await getOptionQuoteForDate(
    conid,
    expiration,
    strike,
    right,
    maturityDate,
  );

  if (!result.ok) {
    if ("notFound" in result) {
      return NextResponse.json(
        {
          error: "no_contract",
          message: "Aucun contrat trouvé pour cette échéance.",
        },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: result.error.kind, message: result.error.message },
      { status: 502 },
    );
  }

  return NextResponse.json({ quote: result.quote });
}

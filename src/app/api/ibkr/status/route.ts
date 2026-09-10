import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { getAuthStatus } from "@/lib/ibkr-gateway/client";

// Statut de session brut du Gateway IBKR — spec technique section 7
// ("IBKR — Statut"), appelle le Gateway en direct (contrairement à
// /api/ibkr/health qui restitue l'état maintenu par le heartbeat).
export async function GET() {
  const session = await auth();
  if (!session?.twoFactorVerified) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const result = await getAuthStatus();

  if (!result.ok) {
    // Erreur normalisée : jamais le corps brut de l'erreur Gateway
    // (spec technique section 7, principe de gestion d'erreur IBKR).
    return NextResponse.json(
      { error: result.error.kind, message: result.error.message },
      { status: 502 },
    );
  }

  return NextResponse.json({
    authenticated: result.data.authenticated,
    connected: result.data.connected,
    competing: result.data.competing,
    latencyMs: result.latencyMs,
  });
}

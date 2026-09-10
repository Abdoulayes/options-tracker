import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import {
  getActiveAccountId,
  getGatewayHealthState,
} from "@/lib/ibkr-gateway/heartbeat-service";

// Statut applicatif normalisé + latence — spec technique section 8.
// Restitue l'état maintenu en mémoire par le heartbeat serveur (démarré au
// boot via src/instrumentation.ts) ; ne déclenche jamais d'appel direct au
// Gateway depuis cette requête (le frontend ne parle qu'à cette route,
// spec technique 8.2).
export async function GET() {
  const session = await auth();
  if (!session?.twoFactorVerified) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const health = getGatewayHealthState();

  return NextResponse.json({
    status: health.status,
    consecutiveFailures: health.consecutiveFailures,
    latencyMs: health.latencyMs,
    lastCheckedAt: health.lastCheckedAt?.toISOString() ?? null,
    lastSuccessAt: health.lastSuccessAt?.toISOString() ?? null,
    accountId: getActiveAccountId(),
  });
}

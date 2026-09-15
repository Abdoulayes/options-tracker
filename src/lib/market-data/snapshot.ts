import { getMarketDataSnapshot } from "@/lib/ibkr-gateway/client";
import type {
  GatewayResult,
  IBKRMarketDataSnapshot,
} from "@/lib/ibkr-gateway/types";

// Le premier appel à /iserver/marketdata/snapshot pour un conid ne fait
// qu'amorcer l'abonnement au flux de marché côté Gateway : les champs
// demandés ne sont peuplés qu'à partir d'un second appel (comportement
// documenté du Client Portal Gateway IBKR). On "amorce" donc
// systématiquement avant de lire la vraie donnée, plutôt que de renvoyer
// une chaîne vide à l'utilisateur.
const SNAPSHOT_PRIMING_DELAY_MS = 1_000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchMarketDataSnapshot(
  conids: string[],
  fields: string[],
): Promise<GatewayResult<IBKRMarketDataSnapshot[]>> {
  const priming = await getMarketDataSnapshot(conids, fields);
  if (!priming.ok) {
    return priming;
  }
  await wait(SNAPSHOT_PRIMING_DELAY_MS);
  return getMarketDataSnapshot(conids, fields);
}

import { getAccounts, tickleSession } from "@/lib/ibkr-gateway/client";
import {
  type GatewayHealthState,
  initialGatewayHealthState,
  nextGatewayHealthState,
} from "@/lib/ibkr-gateway/connection-status";

// Mécanisme de heartbeat serveur — spec technique section 6.2 et 8.1 :
// appelle l'endpoint de maintien de session du Gateway toutes les 40
// secondes (marge de sécurité sous le seuil critique des 60s), quel que
// soit l'état du frontend (l'app est mono-utilisateur, la session IBKR doit
// être maintenue même sans onglet ouvert). Démarré une seule fois au boot du
// serveur via src/instrumentation.ts.
const HEARTBEAT_INTERVAL_MS = 40_000;

type HeartbeatStore = {
  health: GatewayHealthState;
  accountId: string | null;
  timer: NodeJS.Timeout | null;
};

// Protection contre la duplication de l'intervalle lors du hot-reload en
// développement (même pattern que src/lib/prisma.ts).
const globalForHeartbeat = globalThis as unknown as {
  ibkrHeartbeatStore: HeartbeatStore | undefined;
};

function getStore(): HeartbeatStore {
  if (!globalForHeartbeat.ibkrHeartbeatStore) {
    globalForHeartbeat.ibkrHeartbeatStore = {
      health: initialGatewayHealthState,
      accountId: null,
      timer: null,
    };
  }
  return globalForHeartbeat.ibkrHeartbeatStore;
}

async function refreshAccountId(store: HeartbeatStore): Promise<void> {
  // Coût minimal : une fois l'accountId connu, on ne le rafraîchit plus tant
  // que la session reste active. Ne doit jamais impacter le statut de
  // connexion, qui repose uniquement sur le tickle.
  if (store.accountId) {
    return;
  }

  const result = await getAccounts();
  if (result.ok) {
    store.accountId =
      result.data.selectedAccount ?? result.data.accounts[0] ?? null;
  }
}

async function tick(): Promise<void> {
  const store = getStore();
  const result = await tickleSession();
  const now = new Date();

  store.health = nextGatewayHealthState(
    store.health,
    result.ok
      ? { success: true, latencyMs: result.latencyMs }
      : { success: false },
    now,
  );

  if (result.ok) {
    await refreshAccountId(store);
  } else {
    store.accountId = null;
  }
}

export function startHeartbeat(): void {
  const store = getStore();
  if (store.timer) {
    return;
  }

  store.timer = setInterval(() => {
    void tick();
  }, HEARTBEAT_INTERVAL_MS);
  store.timer.unref?.();

  // Premier appel immédiat pour ne pas attendre 40s avant le premier statut.
  void tick();
}

export function getGatewayHealthState(): GatewayHealthState {
  return getStore().health;
}

export function getActiveAccountId(): string | null {
  return getStore().accountId;
}

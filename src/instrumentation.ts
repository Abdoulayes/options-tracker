// Point d'entrée Next.js exécuté une seule fois au démarrage du serveur —
// utilisé ici pour démarrer le heartbeat du Gateway IBKR (spec technique
// section 6.2), indépendamment de toute requête frontend.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startHeartbeat } =
      await import("@/lib/ibkr-gateway/heartbeat-service");
    startHeartbeat();
  }
}

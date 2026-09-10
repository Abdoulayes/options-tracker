// Vitest ne charge pas automatiquement `.env.local` (contrairement à Next.js) ;
// on le fait nous-mêmes pour que `app-config.ts` résolve ses variables
// d'environnement requises pendant les tests locaux.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Absent en CI : les variables doivent alors être fournies autrement.
}

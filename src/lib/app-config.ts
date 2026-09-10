// Point de configuration centralisé de l'application.
// Toute valeur dépendante de l'environnement doit être lue ici, jamais
// codée en dur ni lue directement via process.env ailleurs dans le code
// (cf. CLAUDE.md — Key architectural rules).

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

export const appConfig = {
  database: {
    url: requireEnv("DATABASE_URL"),
  },
  auth: {
    // Secret de signature des sessions NextAuth (JWT).
    nextAuthSecret: requireEnv("NEXTAUTH_SECRET"),
    // Clé AES-256-GCM (32 octets, hex) de chiffrement du secret TOTP — cf. CLAUDE.md.
    twoFactorEncryptionKey: requireEnv("TWO_FACTOR_ENCRYPTION_KEY"),
  },
} as const;

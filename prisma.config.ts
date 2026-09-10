import { defineConfig, env } from "prisma/config";

// Next.js lit `.env.local`, mais la CLI Prisma ne charge que `.env` par
// défaut : on le charge nous-mêmes pour garder une seule source de vérité.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Absent en CI/production, où DATABASE_URL est fourni autrement.
}

// Configuration Prisma 7+ : l'URL de connexion utilisée par la CLI (migrate,
// studio, etc.) est déclarée ici, jamais dans schema.prisma (cf. CLAUDE.md —
// aucune valeur dépendante de l'environnement codée en dur).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

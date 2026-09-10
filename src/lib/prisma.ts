import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { appConfig } from "@/lib/app-config";

// Évite la multiplication des connexions en développement à cause du hot-reload de Next.js.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7+ : la connexion passe par un adapter de driver plutôt que par
// l'URL déclarée dans schema.prisma (cf. prisma.config.ts pour la CLI).
const adapter = new PrismaPg({ connectionString: appConfig.database.url });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

import { prisma } from "@/lib/prisma";

// Lecture des réglages utilisateur (Lot 4 : zone de delta cible pour le
// highlight de la chaîne d'options). Les valeurs par défaut du schéma
// (0.15 / 0.30) sont appliquées via `upsert` si l'utilisateur n'a pas
// encore de ligne `UserSettings` (aucun lot précédent n'en crée une).
export async function getOrCreateUserSettings(userId: string) {
  return prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

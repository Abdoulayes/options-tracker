import { z } from "zod";

// Validation stricte des payloads watchlist — spec technique section 7
// ("chaque endpoint recevant des données en entrée doit valider le payload
// via un schéma de validation strict avant tout traitement").

export const watchlistTagSchema = z.enum([
  "CORE",
  "GROWTH",
  "SPECULATIVE",
  "BLACKLIST",
]);

export const createWatchlistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom de la watchlist est requis.")
    .max(100, "Le nom de la watchlist est trop long (100 caractères max)."),
});

export const updateWatchlistSchema = createWatchlistSchema;

// Symbole boursier : lettres majuscules, chiffres, point et tiret (classes
// d'actions type BRK.B), 1 à 10 caractères.
const symbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "Le symbole est requis.")
  .max(10, "Symbole invalide (10 caractères max).")
  .regex(/^[A-Z0-9.-]+$/, "Symbole invalide.");

const notesSchema = z
  .string()
  .max(2000, "Les notes sont trop longues (2000 caractères max).")
  .nullish();

const targetPriceSchema = z
  .number()
  .positive("Le prix cible doit être positif.")
  .nullish();

export const createTickerSchema = z.object({
  symbol: symbolSchema,
  conid: z.string().trim().min(1).nullish(),
  tag: watchlistTagSchema.nullish(),
  notes: notesSchema,
  targetPrice: targetPriceSchema,
});

export const updateTickerSchema = z.object({
  tag: watchlistTagSchema.nullish(),
  notes: notesSchema,
  targetPrice: targetPriceSchema,
});

// Une ligne de CSV importé — mêmes règles que la création manuelle, en
// tolérant des chaînes vides (converties en `undefined`) pour les champs
// optionnels puisqu'un CSV ne distingue pas absence de valeur et chaîne vide.
export const csvTickerRowSchema = z.object({
  symbol: symbolSchema,
  tag: z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value.toUpperCase()))
    .pipe(watchlistTagSchema.optional())
    .optional(),
  notes: z
    .string()
    .transform((value) => (value.trim() === "" ? undefined : value))
    .optional(),
  targetPrice: z
    .string()
    .transform((value, ctx) => {
      const trimmed = value.trim();
      if (trimmed === "") {
        return undefined;
      }
      const parsed = Number(trimmed);
      if (Number.isNaN(parsed) || parsed <= 0) {
        ctx.addIssue({ code: "custom", message: "Prix cible invalide." });
        return z.NEVER;
      }
      return parsed;
    })
    .optional(),
});

export type CreateTickerInput = z.infer<typeof createTickerSchema>;
export type UpdateTickerInput = z.infer<typeof updateTickerSchema>;
export type CsvTickerRow = z.infer<typeof csvTickerRowSchema>;

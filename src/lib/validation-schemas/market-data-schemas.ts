import { z } from "zod";

// Validation des query params des endpoints marché (Lot 4, spec technique
// section 7 — chaque endpoint recevant des paramètres doit les valider via
// un schéma strict avant tout traitement).

const conidSchema = z
  .string()
  .trim()
  .regex(/^[0-9]+$/, "Identifiant de contrat (conid) invalide.");

export const marketDataQuerySchema = z.object({
  conid: conidSchema,
});

// Mois d'expiration au format IBKR, ex. "SEP26".
const expirationSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}[0-9]{2}$/, "Expiration invalide (format attendu : SEP26).");

// Date d'échéance réelle au format YYYYMMDD (résolue par le Gateway, cf.
// options-chain-service.ts).
const maturityDateSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{8}$/, "Échéance invalide (format attendu : YYYYMMDD).");

export const optionsChainQuerySchema = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Le symbole est requis.")
    .max(10, "Symbole invalide."),
  conid: conidSchema,
  expiration: expirationSchema.optional(),
  maturityDate: maturityDateSchema.optional(),
});

export type MarketDataQuery = z.infer<typeof marketDataQuerySchema>;
export type OptionsChainQuery = z.infer<typeof optionsChainQuerySchema>;

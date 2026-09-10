import { z } from "zod";

export const registerSchema = z.object({
  email: z.email("Adresse email invalide."),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
    .regex(/[a-zA-Z]/, "Le mot de passe doit contenir au moins une lettre.")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre."),
});

export const loginSchema = z.object({
  email: z.email("Adresse email invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});

export const totpCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Le code doit contenir 6 chiffres."),
});

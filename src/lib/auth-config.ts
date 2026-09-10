import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { appConfig } from "@/lib/app-config";
import { loginSchema } from "@/lib/validation-schemas/auth-schemas";
import { findUserByEmail } from "@/lib/auth/user-service";
import { verifyPassword } from "@/lib/auth/password-service";

// Authentification applicative NextAuth (Credentials Provider) — spec
// technique section 5. Totalement indépendante de l'authentification IBKR
// (Gateway), qui n'est jamais référencée ici (section 5.3).
export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  secret: appConfig.auth.nextAuthSecret,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const user = await findUserByEmail(parsed.data.email);
        if (!user) {
          return null;
        }

        const passwordValid = await verifyPassword(
          parsed.data.password,
          user.passwordHash,
        );
        if (!passwordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          twoFactorEnabled: user.twoFactorEnabled,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id;
        token.twoFactorEnabled = user.twoFactorEnabled;
        // Une connexion réussie par mot de passe ne produit qu'une session
        // "en attente de validation" (spec technique 5.1) : la vérification
        // du code TOTP est requise avant l'émission d'une session complète.
        token.twoFactorVerified = false;
      }

      if (trigger === "update" && session) {
        if (typeof session.twoFactorVerified === "boolean") {
          token.twoFactorVerified = session.twoFactorVerified;
        }
        if (typeof session.twoFactorEnabled === "boolean") {
          token.twoFactorEnabled = session.twoFactorEnabled;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.twoFactorEnabled = token.twoFactorEnabled as boolean;
      session.twoFactorVerified = token.twoFactorVerified as boolean;
      return session;
    },
  },
});

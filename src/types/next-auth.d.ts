import type { DefaultSession } from "next-auth";

// Étend les types NextAuth avec les champs applicatifs du Lot 1 :
// - twoFactorEnabled : le 2FA a été configuré pour ce compte
// - twoFactorVerified : le code TOTP a été validé sur CETTE session
//   (session "complète" au sens de la spec technique 5.1, requise par le
//   proxy pour accéder aux routes du groupe (dashboard))
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
    twoFactorEnabled: boolean;
    twoFactorVerified: boolean;
  }

  interface User {
    twoFactorEnabled: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    twoFactorEnabled: boolean;
    twoFactorVerified: boolean;
  }
}

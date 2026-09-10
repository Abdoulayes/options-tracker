import { describe, expect, it } from "vitest";
import {
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
} from "@/lib/auth/two-factor-crypto";

describe("two-factor-crypto", () => {
  it("déchiffre un secret vers sa valeur en clair d'origine", () => {
    const plainSecret = "JBSWY3DPEHPK3PXP";

    const encrypted = encryptTwoFactorSecret(plainSecret);

    expect(encrypted).not.toContain(plainSecret);
    expect(decryptTwoFactorSecret(encrypted)).toBe(plainSecret);
  });

  it("produit un résultat chiffré différent à chaque appel (IV aléatoire)", () => {
    const plainSecret = "JBSWY3DPEHPK3PXP";

    const first = encryptTwoFactorSecret(plainSecret);
    const second = encryptTwoFactorSecret(plainSecret);

    expect(first).not.toBe(second);
  });

  it("rejette un texte chiffré altéré (intégrité AES-GCM)", () => {
    const encrypted = encryptTwoFactorSecret("JBSWY3DPEHPK3PXP");
    const [iv, authTag, ciphertext] = encrypted.split(".");
    const tampered = [iv, authTag, `${ciphertext.slice(0, -2)}AA`].join(".");

    expect(() => decryptTwoFactorSecret(tampered)).toThrow();
  });

  it("rejette un format de texte chiffré invalide", () => {
    expect(() => decryptTwoFactorSecret("pas-le-bon-format")).toThrow();
  });
});

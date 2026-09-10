// Test d'intégration : flow complet login → setup 2FA → vérification →
// session complète (spec technique 5.1, cf. docs/3-decoupage-par-lots.md
// Lot 1). S'exécute contre la base PostgreSQL locale (docker-compose.yml) —
// démarrer le conteneur avant de lancer ce test (voir README des tests).
import { afterAll, describe, expect, it } from "vitest";
import { generate } from "otplib";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password-service";
import {
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
} from "@/lib/auth/two-factor-crypto";
import { generateTotpSecret, verifyTotpCode } from "@/lib/auth/totp-service";
import { MAX_TWO_FACTOR_ATTEMPTS } from "@/lib/auth/two-factor-rate-limit";
import {
  createUser,
  enableTwoFactor,
  findUserByEmail,
  isTwoFactorRateLimited,
  registerFailedTwoFactorAttempt,
  registerSuccessfulTwoFactorAttempt,
  storeTwoFactorSecret,
} from "@/lib/auth/user-service";

const TEST_EMAIL = "lot1-integration-test@example.com";

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

describe("flow complet d'authentification (Lot 1)", () => {
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("inscription → setup 2FA → vérification du code → session complète", async () => {
    await cleanup();

    // 1. Inscription : mot de passe hashé, 2FA pas encore configuré.
    const user = await createUser(TEST_EMAIL, "correct-horse-battery-1");
    expect(
      await verifyPassword("correct-horse-battery-1", user.passwordHash),
    ).toBe(true);
    expect(user.twoFactorEnabled).toBe(false);

    // 2. Setup 2FA : le secret est chiffré avant d'être écrit en base —
    //    jamais en clair (critère d'acceptation du Lot 1).
    const secret = generateTotpSecret();
    await storeTwoFactorSecret(user.id, encryptTwoFactorSecret(secret));

    const stored = await findUserByEmail(TEST_EMAIL);
    expect(stored?.twoFactorSecret).toBeTruthy();
    expect(stored?.twoFactorSecret).not.toBe(secret);
    expect(decryptTwoFactorSecret(stored!.twoFactorSecret!)).toBe(secret);

    // 3. Vérification du code TOTP courant → activation du 2FA + session complète.
    const code = await generate({ secret });
    expect(await verifyTotpCode(code, secret)).toBe(true);

    await enableTwoFactor(user.id);
    await registerSuccessfulTwoFactorAttempt(user.id);

    const finalUser = await findUserByEmail(TEST_EMAIL);
    expect(finalUser?.twoFactorEnabled).toBe(true);
    expect(finalUser?.twoFactorAttempts).toBe(0);
    expect(await isTwoFactorRateLimited(user.id)).toBe(false);
  });

  it("bloque la vérification après 5 tentatives échouées", async () => {
    await cleanup();
    const user = await createUser(TEST_EMAIL, "correct-horse-battery-1");
    const secret = generateTotpSecret();
    await storeTwoFactorSecret(user.id, encryptTwoFactorSecret(secret));

    for (let i = 0; i < MAX_TWO_FACTOR_ATTEMPTS; i++) {
      await registerFailedTwoFactorAttempt(user.id);
    }

    expect(await isTwoFactorRateLimited(user.id)).toBe(true);
  });
});

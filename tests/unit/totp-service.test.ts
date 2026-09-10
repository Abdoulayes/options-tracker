import { describe, expect, it } from "vitest";
import { generate } from "otplib";
import { generateTotpSecret, verifyTotpCode } from "@/lib/auth/totp-service";

describe("totp-service", () => {
  it("valide un code TOTP correct", async () => {
    const secret = generateTotpSecret();
    const code = await generate({ secret });

    await expect(verifyTotpCode(code, secret)).resolves.toBe(true);
  });

  it("rejette un code incorrect", async () => {
    const secret = generateTotpSecret();

    await expect(verifyTotpCode("000000", secret)).resolves.toBe(false);
  });

  it("rejette un code expiré, hors de la fenêtre de tolérance ± 30 secondes", async () => {
    const secret = generateTotpSecret();
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60;
    const expiredCode = await generate({ secret, epoch: fiveMinutesAgo });

    await expect(verifyTotpCode(expiredCode, secret)).resolves.toBe(false);
  });

  it("accepte un code décalé de 30 secondes (dans la fenêtre de tolérance)", async () => {
    const secret = generateTotpSecret();
    const thirtySecondsAgo = Math.floor(Date.now() / 1000) - 30;
    const nearbyCode = await generate({ secret, epoch: thirtySecondsAgo });

    await expect(verifyTotpCode(nearbyCode, secret)).resolves.toBe(true);
  });

  it("rejette un code mal formé sans lever d'exception", async () => {
    const secret = generateTotpSecret();

    await expect(verifyTotpCode("abc", secret)).resolves.toBe(false);
  });
});

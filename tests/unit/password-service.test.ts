import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password-service";

describe("password-service", () => {
  it("valide un mot de passe contre son propre hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple-1");

    await expect(
      verifyPassword("correct-horse-battery-staple-1", hash),
    ).resolves.toBe(true);
  });

  it("rejette un mot de passe incorrect", async () => {
    const hash = await hashPassword("correct-horse-battery-staple-1");

    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("ne stocke jamais le mot de passe en clair dans le hash", async () => {
    const password = "correct-horse-battery-staple-1";
    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
  });
});

import crypto from "node:crypto";
import { appConfig } from "@/lib/app-config";

// Chiffrement du secret TOTP avant stockage en base — jamais en clair
// (cf. CLAUDE.md et spec technique 13.1). Le secret n'est déchiffré que le
// temps strict de la vérification d'un code (src/lib/auth/totp-service.ts).

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

function getKey(): Buffer {
  const key = Buffer.from(appConfig.auth.twoFactorEncryptionKey, "hex");
  if (key.length !== 32) {
    throw new Error(
      "TWO_FACTOR_ENCRYPTION_KEY doit être une chaîne hexadécimale de 32 octets (64 caractères).",
    );
  }
  return key;
}

export function encryptTwoFactorSecret(plainSecret: string): string {
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainSecret, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext]
    .map((buffer) => buffer.toString("base64"))
    .join(".");
}

export function decryptTwoFactorSecret(encrypted: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Format de secret 2FA chiffré invalide.");
  }

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

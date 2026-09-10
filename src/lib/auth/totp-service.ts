import { generate, generateSecret, generateURI, verify } from "otplib";

// Librairie TOTP retenue : otplib (spec technique 5.2 / décision actée).

const ISSUER = "Wheel Strategy Watchlist Tool";
// Fenêtre de tolérance temporelle standard ± 30 secondes (spec technique 5.1).
const EPOCH_TOLERANCE_SECONDS = 30;

export function generateTotpSecret(): string {
  return generateSecret();
}

export function buildOtpAuthUrl(accountEmail: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: accountEmail, secret });
}

export async function generateTotpCode(
  secret: string,
  epoch?: number,
): Promise<string> {
  return generate({ secret, epoch });
}

export async function verifyTotpCode(
  code: string,
  secret: string,
): Promise<boolean> {
  try {
    const result = await verify({
      secret,
      token: code,
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
    });
    return result.valid;
  } catch {
    return false;
  }
}

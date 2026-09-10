import { NextResponse } from "next/server";
import { auth, unstable_update } from "@/lib/auth-config";
import { totpCodeSchema } from "@/lib/validation-schemas/auth-schemas";
import {
  enableTwoFactor,
  findUserById,
  isTwoFactorRateLimited,
  registerFailedTwoFactorAttempt,
  registerSuccessfulTwoFactorAttempt,
} from "@/lib/auth/user-service";
import { decryptTwoFactorSecret } from "@/lib/auth/two-factor-crypto";
import { verifyTotpCode } from "@/lib/auth/totp-service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = totpCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Code invalide : 6 chiffres attendus." },
      { status: 400 },
    );
  }

  const user = await findUserById(session.user.id);
  if (!user || !user.twoFactorSecret) {
    return NextResponse.json(
      { error: "Le 2FA n'est pas configuré pour ce compte." },
      { status: 409 },
    );
  }

  // Rate limiting : 5 tentatives / 15 min (spec technique 5.2).
  if (await isTwoFactorRateLimited(user.id)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429 },
    );
  }

  const secret = decryptTwoFactorSecret(user.twoFactorSecret);
  const isValid = await verifyTotpCode(parsed.data.code, secret);

  if (!isValid) {
    const state = await registerFailedTwoFactorAttempt(user.id);
    return NextResponse.json(
      { error: "Code incorrect.", locked: state.lockedUntil !== null },
      { status: 401 },
    );
  }

  await registerSuccessfulTwoFactorAttempt(user.id);
  if (!user.twoFactorEnabled) {
    await enableTwoFactor(user.id);
  }

  // Émission de la session complète (post-2FA) — spec technique 5.1.
  await unstable_update({ twoFactorVerified: true, twoFactorEnabled: true });

  return NextResponse.json({ success: true });
}

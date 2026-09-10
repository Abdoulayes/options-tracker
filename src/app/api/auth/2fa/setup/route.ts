import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/lib/auth-config";
import { findUserById, storeTwoFactorSecret } from "@/lib/auth/user-service";
import { buildOtpAuthUrl, generateTotpSecret } from "@/lib/auth/totp-service";
import { encryptTwoFactorSecret } from "@/lib/auth/two-factor-crypto";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const user = await findUserById(session.user.id);
  if (!user) {
    return NextResponse.json(
      { error: "Utilisateur introuvable." },
      { status: 404 },
    );
  }

  if (user.twoFactorEnabled) {
    return NextResponse.json(
      { error: "Le 2FA est déjà activé sur ce compte." },
      { status: 409 },
    );
  }

  const secret = generateTotpSecret();
  // Chiffré immédiatement : le secret en clair ne quitte jamais ce handler
  // (spec technique 13.1).
  await storeTwoFactorSecret(user.id, encryptTwoFactorSecret(secret));

  const otpauthUrl = buildOtpAuthUrl(user.email, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return NextResponse.json({ otpauthUrl, qrCodeDataUrl, secret });
}

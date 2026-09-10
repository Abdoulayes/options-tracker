import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password-service";
import {
  afterFailedTwoFactorAttempt,
  afterSuccessfulTwoFactorAttempt,
  isTwoFactorLocked,
  type TwoFactorRateLimitState,
} from "@/lib/auth/two-factor-rate-limit";

export async function createUser(email: string, password: string) {
  const passwordHash = await hashPassword(password);
  return prisma.user.create({ data: { email, passwordHash } });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function storeTwoFactorSecret(
  userId: string,
  encryptedSecret: string,
) {
  return prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: encryptedSecret },
  });
}

export async function enableTwoFactor(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true },
  });
}

export async function isTwoFactorRateLimited(userId: string): Promise<boolean> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { twoFactorAttempts: true, twoFactorLockedUntil: true },
  });

  return isTwoFactorLocked(
    {
      attempts: user.twoFactorAttempts,
      lockedUntil: user.twoFactorLockedUntil,
    },
    new Date(),
  );
}

export async function registerFailedTwoFactorAttempt(
  userId: string,
): Promise<TwoFactorRateLimitState> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { twoFactorAttempts: true, twoFactorLockedUntil: true },
  });

  const next = afterFailedTwoFactorAttempt(
    {
      attempts: user.twoFactorAttempts,
      lockedUntil: user.twoFactorLockedUntil,
    },
    new Date(),
  );

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorAttempts: next.attempts,
      twoFactorLockedUntil: next.lockedUntil,
    },
  });

  return next;
}

export async function registerSuccessfulTwoFactorAttempt(userId: string) {
  const next = afterSuccessfulTwoFactorAttempt();

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorAttempts: next.attempts,
      twoFactorLockedUntil: next.lockedUntil,
    },
  });
}

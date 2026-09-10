-- AlterTable
ALTER TABLE "users" ADD COLUMN "twoFactorAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "twoFactorLockedUntil" TIMESTAMP(3);

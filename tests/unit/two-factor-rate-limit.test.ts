import { describe, expect, it } from "vitest";
import {
  afterFailedTwoFactorAttempt,
  afterSuccessfulTwoFactorAttempt,
  isTwoFactorLocked,
  MAX_TWO_FACTOR_ATTEMPTS,
  TWO_FACTOR_LOCK_WINDOW_MS,
  type TwoFactorRateLimitState,
} from "@/lib/auth/two-factor-rate-limit";

describe("two-factor-rate-limit", () => {
  const now = new Date("2026-09-10T12:00:00.000Z");

  it("ne bloque pas un utilisateur sans tentative échouée", () => {
    const state: TwoFactorRateLimitState = { attempts: 0, lockedUntil: null };

    expect(isTwoFactorLocked(state, now)).toBe(false);
  });

  it("bloque après 5 tentatives échouées", () => {
    let state: TwoFactorRateLimitState = { attempts: 0, lockedUntil: null };

    for (let i = 0; i < MAX_TWO_FACTOR_ATTEMPTS; i++) {
      state = afterFailedTwoFactorAttempt(state, now);
    }

    expect(state.attempts).toBe(MAX_TWO_FACTOR_ATTEMPTS);
    expect(isTwoFactorLocked(state, now)).toBe(true);
    expect(state.lockedUntil?.getTime()).toBe(
      now.getTime() + TWO_FACTOR_LOCK_WINDOW_MS,
    );
  });

  it("ne bloque pas avant d'atteindre le seuil", () => {
    let state: TwoFactorRateLimitState = { attempts: 0, lockedUntil: null };

    for (let i = 0; i < MAX_TWO_FACTOR_ATTEMPTS - 1; i++) {
      state = afterFailedTwoFactorAttempt(state, now);
    }

    expect(isTwoFactorLocked(state, now)).toBe(false);
  });

  it("réinitialise le compteur après une vérification réussie", () => {
    const state = afterSuccessfulTwoFactorAttempt();

    expect(state).toEqual({ attempts: 0, lockedUntil: null });
  });

  it("repart sur un compteur neuf une fois le verrou expiré", () => {
    const lockedState: TwoFactorRateLimitState = {
      attempts: MAX_TWO_FACTOR_ATTEMPTS,
      lockedUntil: new Date(now.getTime() - 1), // verrou expiré depuis 1ms
    };

    const next = afterFailedTwoFactorAttempt(lockedState, now);

    expect(next.attempts).toBe(1);
    expect(next.lockedUntil).toBeNull();
  });

  it("reste verrouillé tant que la fenêtre de 15 minutes n'est pas écoulée", () => {
    let state: TwoFactorRateLimitState = { attempts: 0, lockedUntil: null };
    for (let i = 0; i < MAX_TWO_FACTOR_ATTEMPTS; i++) {
      state = afterFailedTwoFactorAttempt(state, now);
    }

    const justBeforeExpiry = new Date(
      (state.lockedUntil?.getTime() ?? 0) - 1000,
    );
    expect(isTwoFactorLocked(state, justBeforeExpiry)).toBe(true);

    const justAfterExpiry = new Date(
      (state.lockedUntil?.getTime() ?? 0) + 1000,
    );
    expect(isTwoFactorLocked(state, justAfterExpiry)).toBe(false);
  });
});

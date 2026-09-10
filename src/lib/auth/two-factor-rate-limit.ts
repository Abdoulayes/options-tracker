// Rate limiting des tentatives de vérification du code 2FA — 5 tentatives
// par fenêtre de 15 minutes (spec technique 5.2). La logique de décision est
// une fonction pure (testable indépendamment de la base de données) ; l'état
// est persisté sur `User.twoFactorAttempts` / `User.twoFactorLockedUntil`
// pour rester valide entre plusieurs instances serverless (Phase 3).

export const MAX_TWO_FACTOR_ATTEMPTS = 5;
export const TWO_FACTOR_LOCK_WINDOW_MS = 15 * 60 * 1000;

export interface TwoFactorRateLimitState {
  attempts: number;
  lockedUntil: Date | null;
}

export function isTwoFactorLocked(
  state: TwoFactorRateLimitState,
  now: Date,
): boolean {
  return (
    state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime()
  );
}

export function afterFailedTwoFactorAttempt(
  state: TwoFactorRateLimitState,
  now: Date,
): TwoFactorRateLimitState {
  // Si un verrou précédent existait et est désormais expiré, on repart sur
  // un compteur neuf avant de comptabiliser l'échec courant. Un état jamais
  // verrouillé (lockedUntil = null) doit en revanche continuer à accumuler.
  const previousLockExpired =
    state.lockedUntil !== null && state.lockedUntil.getTime() <= now.getTime();
  const base: TwoFactorRateLimitState = previousLockExpired
    ? { attempts: 0, lockedUntil: null }
    : state;

  const attempts = base.attempts + 1;
  const lockedUntil =
    attempts >= MAX_TWO_FACTOR_ATTEMPTS
      ? new Date(now.getTime() + TWO_FACTOR_LOCK_WINDOW_MS)
      : null;

  return { attempts, lockedUntil };
}

export function afterSuccessfulTwoFactorAttempt(): TwoFactorRateLimitState {
  return { attempts: 0, lockedUntil: null };
}

// Calculs purs de la chaîne d'options (Lot 4, spec fonctionnelle Module 4).
// Aucune I/O ici — cf. CLAUDE.md ("Financial calculations ... must live in
// pure functions with no I/O"). Le rendement (yield) reste hors périmètre
// du Lot 4, réservé au Lot 5.

// Distance en % entre un strike et le prix actuel du sous-jacent. Positif
// si le strike est au-dessus du prix actuel, négatif en dessous.
export function calculateStrikeDistancePct(
  strike: number,
  underlyingPrice: number,
): number {
  if (underlyingPrice <= 0) {
    return 0;
  }
  return ((strike - underlyingPrice) / underlyingPrice) * 100;
}

// Un delta est "dans la zone cible" si sa valeur absolue est comprise entre
// les bornes configurées (par défaut 0.15–0.30, cf. UserSettings). Le
// delta d'un put est négatif côté Gateway : on compare toujours la valeur
// absolue, quel que soit le sens (put/call).
export function isDeltaInTargetZone(
  delta: number | null,
  targetDeltaMin: number,
  targetDeltaMax: number,
): boolean {
  if (delta === null) {
    return false;
  }
  const absDelta = Math.abs(delta);
  return absDelta >= targetDeltaMin && absDelta <= targetDeltaMax;
}

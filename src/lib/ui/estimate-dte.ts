// Estimation du DTE à partir d'une échéance réelle (YYYYMMDD), pour
// préremplir ou afficher une valeur de référence dans l'UI. Ce n'est PAS la
// fonction de calcul de gestion du DTE prévue en Lot 7 (seuil de gestion
// 21 jours, etc.) — juste un arrondi au jour près, sans logique métier.
export function estimateDte(maturityDate: string): number {
  const year = Number(maturityDate.slice(0, 4));
  const month = Number(maturityDate.slice(4, 6));
  const day = Number(maturityDate.slice(6, 8));
  const expiration = Date.UTC(year, month - 1, day);
  const today = Date.now();
  return Math.max(0, Math.round((expiration - today) / 86_400_000));
}

// Formatage court "jj/mm/aaaa" pour l'affichage des échéances dans les
// menus déroulants.
export function formatMaturityDate(maturityDate: string): string {
  const year = maturityDate.slice(0, 4);
  const month = maturityDate.slice(4, 6);
  const day = maturityDate.slice(6, 8);
  return `${day}/${month}/${year}`;
}

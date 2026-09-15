// Calculateur de rendement CSP/CC (Lot 5, spec fonctionnelle Module 5,
// spec technique section 9.1). Fonction 100% pure : aucun effet de bord,
// aucun appel réseau ni accès base de données — uniquement des paramètres
// déjà résolus en entrée (cf. CLAUDE.md, exclusions du Lot 5).
//
// Simplification assumée : cette fonction ne reçoit pas de prix de revient
// (cost basis) pour les actions sous-jacentes d'un Covered Call. Le strike
// est donc utilisé comme valeur notionnelle de référence à la fois pour le
// collatéral (CSP) et pour le calcul du rendement (CC) — ce qui rend les
// formules CSP/CC symétriques dans ce modèle simplifié.

export type OptionStrategyType = "CSP" | "CC";

export interface YieldCalculatorParams {
  optionType: OptionStrategyType;
  strike: number;
  premiumPerShare: number;
  dte: number;
  contracts: number;
  feePerContract: number;
  delta?: number | null;
}

export interface YieldCalculatorResult {
  totalPremium: number;
  collateralRequired: number;
  grossYieldPct: number;
  grossAnnualizedYieldPct: number | null;
  totalFees: number;
  netPremium: number;
  netYieldPct: number;
  netAnnualizedYieldPct: number | null;
  breakeven: number;
  maxProfit: number;
  maxLoss: number;
  probabilityItmPct: number | null;
}

const SHARES_PER_CONTRACT = 100;
const DAYS_PER_YEAR = 365;

export function calculateYield(
  params: YieldCalculatorParams,
): YieldCalculatorResult {
  const { strike, premiumPerShare, dte, contracts, feePerContract, delta } =
    params;

  const totalPremium = premiumPerShare * SHARES_PER_CONTRACT * contracts;
  const collateralRequired = strike * SHARES_PER_CONTRACT * contracts;
  const grossYieldPct = (totalPremium / collateralRequired) * 100;

  const totalFees = feePerContract * contracts;
  const netPremium = totalPremium - totalFees;
  const netYieldPct = (netPremium / collateralRequired) * 100;

  // DTE = 0 (option expirant le jour même) : le rendement annualisé n'a pas
  // de sens mathématique (division par zéro) — on le laisse à null plutôt
  // que de renvoyer NaN/Infinity à l'affichage.
  const grossAnnualizedYieldPct =
    dte > 0 ? grossYieldPct * (DAYS_PER_YEAR / dte) : null;
  const netAnnualizedYieldPct =
    dte > 0 ? netYieldPct * (DAYS_PER_YEAR / dte) : null;

  const breakeven = strike - premiumPerShare;
  const maxProfit = totalPremium;
  const maxLoss = (strike - premiumPerShare) * SHARES_PER_CONTRACT * contracts;

  // Approximation usuelle : la probabilité ITM est assimilée à la valeur
  // absolue du delta (un put a un delta négatif côté Gateway).
  const probabilityItmPct =
    delta === null || delta === undefined ? null : Math.abs(delta) * 100;

  return {
    totalPremium,
    collateralRequired,
    grossYieldPct,
    grossAnnualizedYieldPct,
    totalFees,
    netPremium,
    netYieldPct,
    netAnnualizedYieldPct,
    breakeven,
    maxProfit,
    maxLoss,
    probabilityItmPct,
  };
}

// Tests unitaires du calculateur de rendement CSP/CC (Lot 5, cf. CLAUDE.md —
// couverture quasi exhaustive exigée pour les calculs financiers, livrée
// dans le même lot que la fonction).
import { describe, expect, it } from "vitest";
import { calculateYield } from "@/lib/domain-services/yield-calculator";

describe("calculateYield — cas CSP standard", () => {
  it("calcule toutes les métriques pour un CSP avec prime, strike et DTE positifs", () => {
    const result = calculateYield({
      optionType: "CSP",
      strike: 50,
      premiumPerShare: 1.2,
      dte: 30,
      contracts: 1,
      feePerContract: 0.65,
      delta: -0.25,
    });

    expect(result.totalPremium).toBeCloseTo(120);
    expect(result.collateralRequired).toBeCloseTo(5000);
    expect(result.grossYieldPct).toBeCloseTo(2.4);
    expect(result.grossAnnualizedYieldPct).toBeCloseTo(29.2, 4);
    expect(result.totalFees).toBeCloseTo(0.65);
    expect(result.netPremium).toBeCloseTo(119.35);
    expect(result.netYieldPct).toBeCloseTo(2.387);
    expect(result.netAnnualizedYieldPct).toBeCloseTo(29.04183, 3);
    expect(result.breakeven).toBeCloseTo(48.8);
    expect(result.maxProfit).toBeCloseTo(120);
    expect(result.maxLoss).toBeCloseTo(4880);
    expect(result.probabilityItmPct).toBeCloseTo(25);
  });
});

describe("calculateYield — cas CC standard", () => {
  it("calcule toutes les métriques pour un CC avec plusieurs contrats", () => {
    const result = calculateYield({
      optionType: "CC",
      strike: 100,
      premiumPerShare: 2.5,
      dte: 45,
      contracts: 2,
      feePerContract: 0.65,
      delta: 0.3,
    });

    expect(result.totalPremium).toBeCloseTo(500);
    expect(result.collateralRequired).toBeCloseTo(20000);
    expect(result.grossYieldPct).toBeCloseTo(2.5);
    expect(result.grossAnnualizedYieldPct).toBeCloseTo(20.2778, 3);
    expect(result.totalFees).toBeCloseTo(1.3);
    expect(result.netPremium).toBeCloseTo(498.7);
    expect(result.netYieldPct).toBeCloseTo(2.4935);
    expect(result.netAnnualizedYieldPct).toBeCloseTo(20.22506, 3);
    expect(result.breakeven).toBeCloseTo(97.5);
    expect(result.maxProfit).toBeCloseTo(500);
    expect(result.maxLoss).toBeCloseTo(19500);
    expect(result.probabilityItmPct).toBeCloseTo(30);
  });
});

describe("calculateYield — cas limite DTE = 0", () => {
  it("évite toute division par zéro et renvoie null pour les rendements annualisés", () => {
    const result = calculateYield({
      optionType: "CSP",
      strike: 50,
      premiumPerShare: 1,
      dte: 0,
      contracts: 1,
      feePerContract: 0.5,
    });

    expect(result.grossAnnualizedYieldPct).toBeNull();
    expect(result.netAnnualizedYieldPct).toBeNull();
    // Les métriques non-annualisées restent calculables.
    expect(result.totalPremium).toBeCloseTo(100);
    expect(result.grossYieldPct).toBeCloseTo(2);
    expect(result.netYieldPct).toBeCloseTo(1.99);
    expect(Number.isNaN(result.grossYieldPct)).toBe(false);
    expect(Number.isFinite(result.grossYieldPct)).toBe(true);
  });
});

describe("calculateYield — frais supérieurs à la prime", () => {
  it("renvoie un rendement net et un rendement net annualisé négatifs", () => {
    const result = calculateYield({
      optionType: "CC",
      strike: 30,
      premiumPerShare: 0.1,
      dte: 20,
      contracts: 1,
      feePerContract: 15,
    });

    expect(result.totalPremium).toBeCloseTo(10);
    expect(result.totalFees).toBeCloseTo(15);
    expect(result.netPremium).toBeCloseTo(-5);
    expect(result.netYieldPct).toBeLessThan(0);
    expect(result.netAnnualizedYieldPct).not.toBeNull();
    expect(result.netAnnualizedYieldPct as number).toBeLessThan(0);
    // Le rendement brut, lui, reste positif : seul le net est affecté.
    expect(result.grossYieldPct).toBeGreaterThan(0);
  });
});

describe("calculateYield — delta extrême", () => {
  it("approxime une probabilité ITM proche de 0 pour un delta proche de 0", () => {
    const result = calculateYield({
      optionType: "CSP",
      strike: 50,
      premiumPerShare: 0.2,
      dte: 10,
      contracts: 1,
      feePerContract: 0.65,
      delta: -0.01,
    });

    expect(result.probabilityItmPct).toBeCloseTo(1);
  });

  it("approxime une probabilité ITM proche de 100 pour un delta proche de 1", () => {
    const result = calculateYield({
      optionType: "CSP",
      strike: 50,
      premiumPerShare: 4.8,
      dte: 10,
      contracts: 1,
      feePerContract: 0.65,
      delta: -0.99,
    });

    expect(result.probabilityItmPct).toBeCloseTo(99);
  });

  it("renvoie null quand le delta n'est pas fourni", () => {
    const result = calculateYield({
      optionType: "CC",
      strike: 50,
      premiumPerShare: 1,
      dte: 10,
      contracts: 1,
      feePerContract: 0.65,
    });

    expect(result.probabilityItmPct).toBeNull();
  });

  it("renvoie null quand le delta est explicitement null", () => {
    const result = calculateYield({
      optionType: "CC",
      strike: 50,
      premiumPerShare: 1,
      dte: 10,
      contracts: 1,
      feePerContract: 0.65,
      delta: null,
    });

    expect(result.probabilityItmPct).toBeNull();
  });
});

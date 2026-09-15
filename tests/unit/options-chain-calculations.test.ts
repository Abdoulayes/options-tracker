// Tests unitaires des calculs purs de la chaîne d'options (Lot 4, cf.
// CLAUDE.md — les calculs financiers doivent être testés de façon quasi
// exhaustive dans le même lot que celui qui les introduit).
import { describe, expect, it } from "vitest";
import {
  calculateStrikeDistancePct,
  isDeltaInTargetZone,
} from "@/lib/domain-services/options-chain-calculations";

describe("calculateStrikeDistancePct", () => {
  it("renvoie une distance positive quand le strike est au-dessus du prix", () => {
    expect(calculateStrikeDistancePct(110, 100)).toBeCloseTo(10);
  });

  it("renvoie une distance négative quand le strike est en dessous du prix", () => {
    expect(calculateStrikeDistancePct(90, 100)).toBeCloseTo(-10);
  });

  it("renvoie 0 quand le strike est égal au prix actuel", () => {
    expect(calculateStrikeDistancePct(100, 100)).toBe(0);
  });

  it("renvoie 0 si le prix du sous-jacent est invalide (0 ou négatif)", () => {
    expect(calculateStrikeDistancePct(100, 0)).toBe(0);
    expect(calculateStrikeDistancePct(100, -5)).toBe(0);
  });
});

describe("isDeltaInTargetZone", () => {
  it("est vrai quand le delta (call, positif) est dans la zone [min, max]", () => {
    expect(isDeltaInTargetZone(0.2, 0.15, 0.3)).toBe(true);
  });

  it("est vrai quand le delta (put, négatif) est dans la zone en valeur absolue", () => {
    expect(isDeltaInTargetZone(-0.2, 0.15, 0.3)).toBe(true);
  });

  it("est faux quand le delta est en dessous de la borne min", () => {
    expect(isDeltaInTargetZone(0.1, 0.15, 0.3)).toBe(false);
  });

  it("est faux quand le delta est au-dessus de la borne max", () => {
    expect(isDeltaInTargetZone(0.35, 0.15, 0.3)).toBe(false);
  });

  it("inclut les bornes (comparaison large)", () => {
    expect(isDeltaInTargetZone(0.15, 0.15, 0.3)).toBe(true);
    expect(isDeltaInTargetZone(0.3, 0.15, 0.3)).toBe(true);
  });

  it("est faux quand le delta est absent", () => {
    expect(isDeltaInTargetZone(null, 0.15, 0.3)).toBe(false);
  });
});

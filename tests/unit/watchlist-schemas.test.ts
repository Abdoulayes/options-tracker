import { describe, expect, it } from "vitest";
import {
  createTickerSchema,
  createWatchlistSchema,
  csvTickerRowSchema,
  updateTickerSchema,
} from "@/lib/validation-schemas/watchlist-schemas";

describe("createWatchlistSchema", () => {
  it("accepte un nom valide", () => {
    expect(
      createWatchlistSchema.safeParse({ name: "Wheel Core" }).success,
    ).toBe(true);
  });

  it("rejette un nom vide", () => {
    expect(createWatchlistSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejette un nom trop long", () => {
    expect(
      createWatchlistSchema.safeParse({ name: "a".repeat(101) }).success,
    ).toBe(false);
  });
});

describe("createTickerSchema", () => {
  it("accepte un ticker minimal (symbole seul)", () => {
    const result = createTickerSchema.safeParse({ symbol: "aapl" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.symbol).toBe("AAPL");
  });

  it("accepte un ticker complet", () => {
    const result = createTickerSchema.safeParse({
      symbol: "BRK.B",
      conid: "12345",
      tag: "CORE",
      notes: "Thèse d'investissement",
      targetPrice: 350.5,
    });
    expect(result.success).toBe(true);
  });

  it("rejette un symbole vide", () => {
    expect(createTickerSchema.safeParse({ symbol: "" }).success).toBe(false);
  });

  it("rejette un symbole avec des caractères invalides", () => {
    expect(createTickerSchema.safeParse({ symbol: "AAPL!" }).success).toBe(
      false,
    );
  });

  it("rejette un tag inconnu", () => {
    expect(
      createTickerSchema.safeParse({ symbol: "AAPL", tag: "UNKNOWN" }).success,
    ).toBe(false);
  });

  it("rejette un prix cible négatif", () => {
    expect(
      createTickerSchema.safeParse({ symbol: "AAPL", targetPrice: -1 }).success,
    ).toBe(false);
  });

  it("rejette des notes trop longues", () => {
    expect(
      createTickerSchema.safeParse({
        symbol: "AAPL",
        notes: "a".repeat(2001),
      }).success,
    ).toBe(false);
  });
});

describe("updateTickerSchema", () => {
  it("accepte un objet vide (aucun champ modifié)", () => {
    expect(updateTickerSchema.safeParse({}).success).toBe(true);
  });

  it("accepte la remise à null d'un tag", () => {
    expect(updateTickerSchema.safeParse({ tag: null }).success).toBe(true);
  });
});

describe("csvTickerRowSchema", () => {
  it("accepte une ligne complète", () => {
    const result = csvTickerRowSchema.safeParse({
      symbol: "MSFT",
      tag: "GROWTH",
      notes: "Note libre",
      targetPrice: "410.25",
    });
    expect(result.success).toBe(true);
  });

  it("accepte une ligne avec seulement le symbole (champs optionnels vides)", () => {
    const result = csvTickerRowSchema.safeParse({
      symbol: "MSFT",
      tag: "",
      notes: "",
      targetPrice: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tag).toBeUndefined();
      expect(result.data.notes).toBeUndefined();
      expect(result.data.targetPrice).toBeUndefined();
    }
  });

  it("rejette un symbole vide", () => {
    expect(
      csvTickerRowSchema.safeParse({
        symbol: "",
        tag: "",
        notes: "",
        targetPrice: "",
      }).success,
    ).toBe(false);
  });

  it("rejette un prix cible non numérique", () => {
    expect(
      csvTickerRowSchema.safeParse({
        symbol: "MSFT",
        tag: "",
        notes: "",
        targetPrice: "pas-un-nombre",
      }).success,
    ).toBe(false);
  });
});

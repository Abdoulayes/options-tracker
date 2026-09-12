import { describe, expect, it } from "vitest";
import { buildWatchlistCsv, parseWatchlistCsv } from "@/lib/watchlists/csv";

describe("parseWatchlistCsv", () => {
  it("parse un CSV avec en-tête et toutes les colonnes", () => {
    const csv = [
      "symbol,tag,notes,targetPrice",
      "AAPL,CORE,Belle thèse,180.5",
      "MSFT,GROWTH,,",
    ].join("\n");

    const { rows } = parseWatchlistCsv(csv);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      ok: true,
      row: {
        symbol: "AAPL",
        tag: "CORE",
        notes: "Belle thèse",
        targetPrice: 180.5,
      },
    });
    expect(rows[1]).toMatchObject({
      ok: true,
      row: { symbol: "MSFT", tag: "GROWTH" },
    });
  });

  it("parse un CSV sans en-tête (symbole seul)", () => {
    const csv = "AAPL\nMSFT";
    const { rows } = parseWatchlistCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.ok)).toBe(true);
  });

  it("gère les doublons volontaires dans le fichier (chaque ligne est retournée, la déduplication est faite au niveau du service)", () => {
    const csv = ["symbol", "AAPL", "AAPL", "MSFT"].join("\n");
    const { rows } = parseWatchlistCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.ok && r.row.symbol === "AAPL")).toHaveLength(2);
  });

  it("gère les champs contenant des virgules entre guillemets", () => {
    const csv = 'symbol,tag,notes,targetPrice\nAAPL,CORE,"Thèse, prudente",100';
    const { rows } = parseWatchlistCsv(csv);
    expect(rows[0]).toMatchObject({
      ok: true,
      row: { notes: "Thèse, prudente" },
    });
  });

  it("rapporte une ligne invalide sans bloquer les autres", () => {
    const csv = ["symbol", "AAPL!", "MSFT"].join("\n");
    const { rows } = parseWatchlistCsv(csv);
    expect(rows[0].ok).toBe(false);
    expect(rows[1].ok).toBe(true);
  });

  it("retourne un tableau vide pour un CSV vide", () => {
    expect(parseWatchlistCsv("").rows).toEqual([]);
  });
});

describe("buildWatchlistCsv", () => {
  it("génère un CSV avec en-tête et échappe les champs contenant des virgules", () => {
    const csv = buildWatchlistCsv([
      { symbol: "AAPL", tag: "CORE", notes: "Simple", targetPrice: 180 },
      { symbol: "MSFT", tag: null, notes: "Avec, virgule", targetPrice: null },
    ]);

    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("symbol,tag,notes,targetPrice");
    expect(lines[1]).toBe("AAPL,CORE,Simple,180");
    expect(lines[2]).toBe('MSFT,,"Avec, virgule",');
  });

  it("round-trip : le CSV généré est ré-importable", () => {
    const csv = buildWatchlistCsv([
      {
        symbol: "AAPL",
        tag: "CORE",
        notes: "Thèse, prudente",
        targetPrice: 180.5,
      },
    ]);
    const { rows } = parseWatchlistCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ok: true,
      row: {
        symbol: "AAPL",
        tag: "CORE",
        notes: "Thèse, prudente",
        targetPrice: 180.5,
      },
    });
  });
});

// Test d'intégration : CRUD complet sur les watchlists (Lot 3, cf.
// docs/3-decoupage-par-lots.md). S'exécute contre la base PostgreSQL locale
// (docker-compose.yml) — démarrer le conteneur avant de lancer ce test.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createUser } from "@/lib/auth/user-service";
import {
  addTicker,
  createWatchlist,
  deleteWatchlist,
  DuplicateTickerError,
  getWatchlistWithTickers,
  importTickers,
  listWatchlists,
  removeTicker,
  renameWatchlist,
  updateTicker,
  WatchlistNotFoundError,
} from "@/lib/watchlists/watchlist-service";
import { parseWatchlistCsv } from "@/lib/watchlists/csv";

const TEST_EMAIL = "lot3-integration-test@example.com";
const OTHER_EMAIL = "lot3-integration-test-other@example.com";

async function cleanup() {
  await prisma.user.deleteMany({
    where: { email: { in: [TEST_EMAIL, OTHER_EMAIL] } },
  });
}

describe("CRUD watchlist (Lot 3)", () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("un utilisateur peut créer plusieurs watchlists et y ajouter des tickers", async () => {
    const user = await createUser(TEST_EMAIL, "correct-horse-battery-1");

    const core = await createWatchlist(user.id, "Core");
    const speculative = await createWatchlist(user.id, "Speculative");

    const watchlists = await listWatchlists(user.id);
    expect(watchlists.map((w) => w.name).sort()).toEqual([
      "Core",
      "Speculative",
    ]);

    await addTicker(user.id, core.id, { symbol: "AAPL", tag: "CORE" });
    await addTicker(user.id, speculative.id, { symbol: "GME" });

    const coreDetail = await getWatchlistWithTickers(user.id, core.id);
    expect(coreDetail?.tickers.map((t) => t.symbol)).toEqual(["AAPL"]);
  });

  it("rejette l'ajout d'un ticker déjà présent dans la même watchlist", async () => {
    const user = await createUser(TEST_EMAIL, "correct-horse-battery-1");
    const watchlist = await createWatchlist(user.id, "Core");

    await addTicker(user.id, watchlist.id, { symbol: "AAPL" });

    await expect(
      addTicker(user.id, watchlist.id, { symbol: "AAPL" }),
    ).rejects.toThrow(DuplicateTickerError);

    const detail = await getWatchlistWithTickers(user.id, watchlist.id);
    expect(detail?.tickers).toHaveLength(1);
  });

  it("persiste et restitue les tags, notes et prix cible après rechargement", async () => {
    const user = await createUser(TEST_EMAIL, "correct-horse-battery-1");
    const watchlist = await createWatchlist(user.id, "Core");

    const ticker = await addTicker(user.id, watchlist.id, {
      symbol: "AAPL",
      tag: "CORE",
      notes: "Thèse solide",
      targetPrice: 150.25,
    });

    await updateTicker(user.id, watchlist.id, ticker.id, {
      tag: "GROWTH",
      notes: "Thèse mise à jour",
      targetPrice: 160,
    });

    // Simule un rechargement : nouvelle lecture depuis la base.
    const reloaded = await getWatchlistWithTickers(user.id, watchlist.id);
    const reloadedTicker = reloaded?.tickers[0];
    expect(reloadedTicker?.tag).toBe("GROWTH");
    expect(reloadedTicker?.notes).toBe("Thèse mise à jour");
    expect(Number(reloadedTicker?.targetPrice)).toBe(160);
  });

  it("supprime un ticker puis une watchlist", async () => {
    const user = await createUser(TEST_EMAIL, "correct-horse-battery-1");
    const watchlist = await createWatchlist(user.id, "Core");
    const ticker = await addTicker(user.id, watchlist.id, {
      symbol: "AAPL",
    });

    await removeTicker(user.id, watchlist.id, ticker.id);
    const afterRemove = await getWatchlistWithTickers(user.id, watchlist.id);
    expect(afterRemove?.tickers).toHaveLength(0);

    await deleteWatchlist(user.id, watchlist.id);
    expect(await getWatchlistWithTickers(user.id, watchlist.id)).toBeNull();
  });

  it("empêche un utilisateur d'accéder à la watchlist d'un autre utilisateur", async () => {
    const owner = await createUser(TEST_EMAIL, "correct-horse-battery-1");
    const intruder = await createUser(OTHER_EMAIL, "correct-horse-battery-1");
    const watchlist = await createWatchlist(owner.id, "Core");

    expect(await getWatchlistWithTickers(intruder.id, watchlist.id)).toBeNull();
    await expect(
      renameWatchlist(intruder.id, watchlist.id, "Hacked"),
    ).rejects.toThrow(WatchlistNotFoundError);
  });

  it("importe les tickers d'un CSV en gérant les doublons volontaires", async () => {
    const user = await createUser(TEST_EMAIL, "correct-horse-battery-1");
    const watchlist = await createWatchlist(user.id, "Core");
    await addTicker(user.id, watchlist.id, { symbol: "AAPL" });

    const csv = [
      "symbol,tag,notes,targetPrice",
      "AAPL,CORE,Déjà présent,100", // doublon vis-à-vis de l'existant
      "MSFT,GROWTH,,",
      "MSFT,GROWTH,,", // doublon dans le fichier lui-même
      "INVALID!,,,", // ligne invalide
    ].join("\n");

    const { rows } = parseWatchlistCsv(csv);
    const summary = await importTickers(user.id, watchlist.id, rows);

    expect(summary.added).toEqual(["MSFT"]);
    expect(summary.skippedDuplicates).toEqual(["AAPL", "MSFT"]);
    expect(summary.invalid).toHaveLength(1);

    const detail = await getWatchlistWithTickers(user.id, watchlist.id);
    expect(detail?.tickers.map((t) => t.symbol).sort()).toEqual([
      "AAPL",
      "MSFT",
    ]);
  });
});

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CreateTickerInput,
  UpdateTickerInput,
} from "@/lib/validation-schemas/watchlist-schemas";

// Couche de service Watchlist (Lot 3, spec technique section 4/7). Toutes
// les opérations sont scopées au `userId` de la session — jamais d'accès à
// une watchlist appartenant à un autre utilisateur (l'app reste
// mono-utilisateur en v1, mais le scoping est conservé par principe).

export class WatchlistNotFoundError extends Error {}
export class DuplicateTickerError extends Error {}

export function listWatchlists(userId: string) {
  return prisma.watchlist.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { tickers: true } } },
  });
}

export function createWatchlist(userId: string, name: string) {
  return prisma.watchlist.create({ data: { userId, name } });
}

async function findOwnedWatchlist(userId: string, watchlistId: string) {
  const watchlist = await prisma.watchlist.findUnique({
    where: { id: watchlistId },
  });
  if (!watchlist || watchlist.userId !== userId) {
    return null;
  }
  return watchlist;
}

export async function getWatchlistWithTickers(
  userId: string,
  watchlistId: string,
) {
  const watchlist = await findOwnedWatchlist(userId, watchlistId);
  if (!watchlist) {
    return null;
  }

  const tickers = await prisma.watchlistTicker.findMany({
    where: { watchlistId },
    orderBy: { symbol: "asc" },
  });

  return { ...watchlist, tickers };
}

export async function renameWatchlist(
  userId: string,
  watchlistId: string,
  name: string,
) {
  const watchlist = await findOwnedWatchlist(userId, watchlistId);
  if (!watchlist) {
    throw new WatchlistNotFoundError();
  }
  return prisma.watchlist.update({
    where: { id: watchlistId },
    data: { name },
  });
}

export async function deleteWatchlist(userId: string, watchlistId: string) {
  const watchlist = await findOwnedWatchlist(userId, watchlistId);
  if (!watchlist) {
    throw new WatchlistNotFoundError();
  }
  await prisma.watchlist.delete({ where: { id: watchlistId } });
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function addTicker(
  userId: string,
  watchlistId: string,
  input: CreateTickerInput,
) {
  const watchlist = await findOwnedWatchlist(userId, watchlistId);
  if (!watchlist) {
    throw new WatchlistNotFoundError();
  }

  try {
    return await prisma.watchlistTicker.create({
      data: {
        watchlistId,
        symbol: input.symbol,
        conid: input.conid ?? null,
        tag: input.tag ?? null,
        notes: input.notes ?? null,
        targetPrice: input.targetPrice ?? null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new DuplicateTickerError(
        `Le ticker ${input.symbol} est déjà présent dans cette watchlist.`,
      );
    }
    throw error;
  }
}

async function findOwnedTicker(
  userId: string,
  watchlistId: string,
  tickerId: string,
) {
  const watchlist = await findOwnedWatchlist(userId, watchlistId);
  if (!watchlist) {
    return null;
  }
  const ticker = await prisma.watchlistTicker.findUnique({
    where: { id: tickerId },
  });
  if (!ticker || ticker.watchlistId !== watchlistId) {
    return null;
  }
  return ticker;
}

export async function updateTicker(
  userId: string,
  watchlistId: string,
  tickerId: string,
  input: UpdateTickerInput,
) {
  const ticker = await findOwnedTicker(userId, watchlistId, tickerId);
  if (!ticker) {
    throw new WatchlistNotFoundError();
  }

  return prisma.watchlistTicker.update({
    where: { id: tickerId },
    data: {
      tag: input.tag ?? null,
      notes: input.notes ?? null,
      targetPrice: input.targetPrice ?? null,
    },
  });
}

export async function removeTicker(
  userId: string,
  watchlistId: string,
  tickerId: string,
) {
  const ticker = await findOwnedTicker(userId, watchlistId, tickerId);
  if (!ticker) {
    throw new WatchlistNotFoundError();
  }
  await prisma.watchlistTicker.delete({ where: { id: tickerId } });
}

export type ImportSummary = {
  added: string[];
  skippedDuplicates: string[];
  invalid: { line: number; error: string }[];
};

// Import en masse : chaque ligne valide est ajoutée individuellement afin
// qu'un doublon (contrainte d'unicité (watchlistId, symbol)) ne bloque pas
// le reste de l'import — conforme au critère d'acceptation du Lot 3
// ("l'import CSV ajoute correctement les tickers avec gestion des
// doublons").
export async function importTickers(
  userId: string,
  watchlistId: string,
  rows: (
    | { line: number; ok: true; row: CreateTickerInput }
    | { line: number; ok: false; error: string }
  )[],
): Promise<ImportSummary> {
  const watchlist = await findOwnedWatchlist(userId, watchlistId);
  if (!watchlist) {
    throw new WatchlistNotFoundError();
  }

  const summary: ImportSummary = {
    added: [],
    skippedDuplicates: [],
    invalid: [],
  };

  for (const result of rows) {
    if (!result.ok) {
      summary.invalid.push({ line: result.line, error: result.error });
      continue;
    }

    try {
      await addTicker(userId, watchlistId, result.row);
      summary.added.push(result.row.symbol);
    } catch (error) {
      if (error instanceof DuplicateTickerError) {
        summary.skippedDuplicates.push(result.row.symbol);
        continue;
      }
      throw error;
    }
  }

  return summary;
}

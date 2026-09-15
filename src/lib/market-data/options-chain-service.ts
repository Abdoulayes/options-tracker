import {
  getOptionContractInfo,
  getOptionStrikes,
  MARKET_DATA_FIELD_IDS,
  searchTicker,
} from "@/lib/ibkr-gateway/client";
import type {
  GatewayError,
  IBKRMarketDataSnapshot,
} from "@/lib/ibkr-gateway/types";
import { fetchMarketDataSnapshot } from "@/lib/market-data/snapshot";
import { calculateStrikeDistancePct } from "@/lib/domain-services/options-chain-calculations";

// Orchestration des appels Gateway nécessaires à la chaîne d'options
// (Lot 4, spec fonctionnelle Module 4 / spec technique sections 6-7).
// Aucun appel direct au Gateway depuis les routes API : tout passe par ce
// module, qui compose les primitives de src/lib/ibkr-gateway/client.ts.

export type OptionQuote = {
  conid: number;
  // Date d'échéance réelle du contrat (YYYYMMDD), telle que résolue par le
  // Gateway — peut différer du "mois" affiché en tab si le sous-jacent a
  // des expirations hebdomadaires (cf. selectedMaturityDate).
  maturityDate: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  volume: number | null;
  openInterest: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  impliedVolatility: number | null;
};

export type OptionsChainRow = {
  strike: number;
  distancePct: number;
  put: OptionQuote | null;
  call: OptionQuote | null;
};

export type OptionsChainResult =
  | {
      ok: true;
      underlying: { conid: number; last: number | null };
      // Dates d'échéance réelles (YYYYMMDD) trouvées dans le mois demandé,
      // et celle effectivement utilisée pour construire `rows`. Un mois
      // IBKR peut regrouper plusieurs vendredis d'expiration (options
      // hebdomadaires) — cf. commentaire sur getOptionsChain.
      availableMaturityDates: string[];
      selectedMaturityDate: string | null;
      rows: OptionsChainRow[];
    }
  | { ok: false; error: GatewayError };

// Le Gateway IBKR tolère un débit très limité en pratique (observé : un 429
// dès quelques requêtes concurrentes sur /iserver/secdef/info pour des
// sous-jacents à strikes rapprochés comme MSFT/GOOG). On résout donc les
// conids strictement en séquentiel, avec un court délai entre chaque appel,
// plutôt que par lots concurrents.
const CONTRACT_INFO_BATCH_SIZE = 1;
const CONTRACT_INFO_BATCH_DELAY_MS = 500;

// Un même sous-jacent peut avoir des strikes très éloignés du prix actuel
// et/ou très rapprochés (ex. MSFT, GOOG : paliers de 2.50$/5$ sur une large
// fourchette de prix). Les résoudre tous en conids via /iserver/secdef/info
// (un appel par strike) déclenche systématiquement un 429 sur ce type de
// chaîne. On combine donc une bande autour du prix courant et un plafond
// strict sur le nombre de strikes résolus (les plus proches du prix
// actuel) — largement suffisant pour une stratégie Wheel (zone de delta
// cible 0.15-0.30, cf. UserSettings) et cohérent avec l'exclusion du Lot 4
// (pas de rendement, juste la consultation de la chaîne).
const STRIKE_BAND_PCT = 0.3;
const MAX_STRIKES_TO_RESOLVE = 16;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map(fn))));
    if (i + batchSize < items.length) {
      await wait(delayMs);
    }
  }
  return results;
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  // Le Gateway peut préfixer certains champs (ex. "C1.25" pour "closed").
  const numeric = Number(value.replace(/^[A-Za-z]+/, ""));
  return Number.isNaN(numeric) ? null : numeric;
}

function toQuote(
  snapshot: IBKRMarketDataSnapshot | undefined,
  conid: number,
  maturityDate: string,
): OptionQuote | null {
  if (!snapshot) {
    return null;
  }
  return {
    conid,
    maturityDate,
    bid: parseNumber(snapshot[MARKET_DATA_FIELD_IDS.bid]),
    ask: parseNumber(snapshot[MARKET_DATA_FIELD_IDS.ask]),
    last: parseNumber(snapshot[MARKET_DATA_FIELD_IDS.last]),
    volume: parseNumber(snapshot[MARKET_DATA_FIELD_IDS.volume]),
    openInterest: parseNumber(snapshot[MARKET_DATA_FIELD_IDS.openInterest]),
    delta: parseNumber(snapshot[MARKET_DATA_FIELD_IDS.delta]),
    gamma: parseNumber(snapshot[MARKET_DATA_FIELD_IDS.gamma]),
    theta: parseNumber(snapshot[MARKET_DATA_FIELD_IDS.theta]),
    vega: parseNumber(snapshot[MARKET_DATA_FIELD_IDS.vega]),
    impliedVolatility: parseNumber(
      snapshot[MARKET_DATA_FIELD_IDS.impliedVolatility],
    ),
  };
}

// Liste les mois d'expiration disponibles pour un conid, à partir de la
// section "OPT" renvoyée par la recherche de ticker (seule source
// d'expirations exposée par le Gateway sans en connaître déjà une).
export async function listExpirations(
  symbol: string,
  conid: string,
): Promise<
  | { ok: true; expirations: string[] }
  | { ok: false; error: GatewayError }
  | { ok: false; notFound: true }
> {
  const result = await searchTicker(symbol);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const entry = result.data.find((r) => r.conid === conid);
  const optSection = entry?.sections?.find((s) => s.secType === "OPT");
  if (!optSection?.months) {
    return { ok: false, notFound: true };
  }

  return {
    ok: true,
    expirations: optSection.months.split(";").filter(Boolean),
  };
}

// Un "mois" IBKR (ex. "SEP26") peut regrouper plusieurs échéances réelles
// distinctes lorsque le sous-jacent a des options hebdomadaires (chaque
// vendredi du mois) : /iserver/secdef/info renvoie alors, pour un même
// strike, une entrée par échéance réelle. On ne le sait qu'après avoir
// résolu les strikes, donc `expiration` (le mois) sélectionne le lot de
// requêtes à faire, et `maturityDate` (optionnel, YYYYMMDD) affine ensuite
// sur l'échéance réelle choisie par l'utilisateur — par défaut la plus
// proche. Sans ce filtrage, deux échéances différentes du même strike se
// seraient silencieusement écrasées l'une l'autre.
export async function getOptionsChain(
  conid: string,
  expiration: string,
  maturityDate?: string,
): Promise<OptionsChainResult> {
  const strikesResult = await getOptionStrikes(conid, expiration);
  if (!strikesResult.ok) {
    return { ok: false, error: strikesResult.error };
  }

  const allStrikes = Array.from(
    new Set([...strikesResult.data.call, ...strikesResult.data.put]),
  ).sort((a, b) => a - b);

  if (allStrikes.length === 0) {
    return {
      ok: false,
      error: {
        kind: "invalid_response",
        message: "Aucun strike disponible pour cette expiration.",
      },
    };
  }

  const underlyingConid = Number(conid);

  // Snapshot précoce, léger (un seul conid), pour connaître le prix actuel
  // avant de restreindre les strikes à résoudre — cf. STRIKE_BAND_PCT.
  const underlyingSnapshotResult = await fetchMarketDataSnapshot(
    [String(underlyingConid)],
    [MARKET_DATA_FIELD_IDS.last],
  );
  if (!underlyingSnapshotResult.ok) {
    return { ok: false, error: underlyingSnapshotResult.error };
  }
  const earlyUnderlyingLast = parseNumber(
    underlyingSnapshotResult.data[0]?.[MARKET_DATA_FIELD_IDS.last],
  );

  const strikesInBand = earlyUnderlyingLast
    ? allStrikes.filter(
        (strike) =>
          Math.abs(strike - earlyUnderlyingLast) / earlyUnderlyingLast <=
          STRIKE_BAND_PCT,
      )
    : allStrikes;
  // Si le prix actuel n'est pas disponible, ou si le filtre élimine tout
  // (cas limite, ex. sous-jacent en forte hausse/baisse depuis le dernier
  // rebalancement des strikes), on retombe sur la liste complète plutôt que
  // d'afficher une chaîne vide.
  const candidateStrikes =
    strikesInBand.length > 0 ? strikesInBand : allStrikes;

  // Plafond dur, indépendant de la bande : garde les strikes les plus
  // proches du prix actuel (ou du centre de la fourchette si le prix est
  // indisponible), pour ne jamais dépasser MAX_STRIKES_TO_RESOLVE appels
  // /iserver/secdef/info, quelle que soit la densité de strikes du titre.
  const referencePrice =
    earlyUnderlyingLast ??
    candidateStrikes[Math.floor(candidateStrikes.length / 2)];
  const strikesToResolve = [...candidateStrikes]
    .sort((a, b) => Math.abs(a - referencePrice) - Math.abs(b - referencePrice))
    .slice(0, MAX_STRIKES_TO_RESOLVE)
    .sort((a, b) => a - b);

  const infoResults = await mapInBatches(
    strikesToResolve,
    CONTRACT_INFO_BATCH_SIZE,
    CONTRACT_INFO_BATCH_DELAY_MS,
    (strike) => getOptionContractInfo(conid, expiration, strike),
  );

  const failedInfo = infoResults.find((r) => !r.ok);
  if (failedInfo && !failedInfo.ok) {
    return { ok: false, error: failedInfo.error };
  }

  const rawContracts = infoResults.flatMap((result) =>
    result.ok ? result.data : [],
  );

  const availableMaturityDates = Array.from(
    new Set(rawContracts.map((c) => c.maturityDate)),
  ).sort();

  if (availableMaturityDates.length === 0) {
    return {
      ok: false,
      error: {
        kind: "invalid_response",
        message: "Aucune échéance résolue pour ce mois.",
      },
    };
  }

  const selectedMaturityDate = availableMaturityDates.includes(
    maturityDate ?? "",
  )
    ? (maturityDate as string)
    : availableMaturityDates[0];

  const contractsForSelectedDate = rawContracts.filter(
    (c) => c.maturityDate === selectedMaturityDate,
  );

  // strike -> { put?: {conid, maturityDate}, call?: {...} }
  const contractsByStrike = new Map<
    number,
    {
      put?: { conid: number; maturityDate: string };
      call?: { conid: number; maturityDate: string };
    }
  >();
  for (const contract of contractsForSelectedDate) {
    const entry = contractsByStrike.get(contract.strike) ?? {};
    if (contract.right === "P") {
      entry.put = {
        conid: contract.conid,
        maturityDate: contract.maturityDate,
      };
    } else if (contract.right === "C") {
      entry.call = {
        conid: contract.conid,
        maturityDate: contract.maturityDate,
      };
    }
    contractsByStrike.set(contract.strike, entry);
  }

  const optionConids = [...contractsByStrike.values()]
    .flatMap((c) =>
      [c.put, c.call].filter(
        (v): v is { conid: number; maturityDate: string } => v !== undefined,
      ),
    )
    .map((c) => c.conid);

  const snapshotResult = await fetchMarketDataSnapshot(
    [String(underlyingConid), ...optionConids.map(String)],
    Object.values(MARKET_DATA_FIELD_IDS),
  );
  if (!snapshotResult.ok) {
    return { ok: false, error: snapshotResult.error };
  }

  const snapshotByConid = new Map(snapshotResult.data.map((s) => [s.conid, s]));

  const underlyingLast = parseNumber(
    snapshotByConid.get(underlyingConid)?.[MARKET_DATA_FIELD_IDS.last],
  );

  const rows: OptionsChainRow[] = strikesToResolve.map((strike) => {
    const contracts = contractsByStrike.get(strike) ?? {};
    return {
      strike,
      distancePct: underlyingLast
        ? calculateStrikeDistancePct(strike, underlyingLast)
        : 0,
      put: contracts.put
        ? toQuote(
            snapshotByConid.get(contracts.put.conid),
            contracts.put.conid,
            contracts.put.maturityDate,
          )
        : null,
      call: contracts.call
        ? toQuote(
            snapshotByConid.get(contracts.call.conid),
            contracts.call.conid,
            contracts.call.maturityDate,
          )
        : null,
    };
  });

  return {
    ok: true,
    underlying: { conid: underlyingConid, last: underlyingLast },
    availableMaturityDates,
    selectedMaturityDate,
    rows,
  };
}

import {
  csvTickerRowSchema,
  type CsvTickerRow,
} from "@/lib/validation-schemas/watchlist-schemas";

// Import/Export CSV des tickers d'une watchlist (Lot 3). Fonctions pures,
// sans I/O, pour rester testables indépendamment de la base de données.

const EXPECTED_HEADERS = ["symbol", "tag", "notes", "targetPrice"] as const;

export type CsvImportRowResult =
  | { line: number; ok: true; row: CsvTickerRow }
  | { line: number; ok: false; error: string };

export type CsvImportParseResult = {
  rows: CsvImportRowResult[];
};

// Parseur CSV minimal conforme RFC 4180 (guillemets, virgules et retours à
// la ligne échappés dans les champs cités) — suffisant pour le champ notes
// en texte libre, sans dépendance externe.
function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1;
      continue;
    }
    if (char === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  // Dernière ligne sans retour à la ligne final.
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows.filter((line) => !(line.length === 1 && line[0] === ""));
}

// Parse le contenu CSV brut d'un import de tickers. Chaque ligne est
// validée indépendamment (une ligne invalide n'empêche pas les autres
// d'être importées) — la gestion des doublons se fait au niveau du
// service applicatif (contrainte d'unicité en base).
export function parseWatchlistCsv(text: string): CsvImportParseResult {
  const lines = parseCsvLines(text.trim());

  if (lines.length === 0) {
    return { rows: [] };
  }

  const header = lines[0].map((cell) => cell.trim().toLowerCase());
  const hasHeader = header[0] === "symbol";
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const lineOffset = hasHeader ? 2 : 1;

  const columns = hasHeader
    ? header
    : EXPECTED_HEADERS.map((name) => name.toLowerCase());

  const rows: CsvImportRowResult[] = dataLines.map((cells, index) => {
    const record: Record<string, string> = {};
    columns.forEach((columnName, columnIndex) => {
      record[columnName] = cells[columnIndex] ?? "";
    });

    const parsed = csvTickerRowSchema.safeParse({
      symbol: record.symbol ?? "",
      tag: record.tag ?? "",
      notes: record.notes ?? "",
      targetPrice: record.targetprice ?? record.targetPrice ?? "",
    });

    if (!parsed.success) {
      return {
        line: index + lineOffset,
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Ligne invalide.",
      };
    }

    return { line: index + lineOffset, ok: true, row: parsed.data };
  });

  return { rows };
}

export type ExportableTicker = {
  symbol: string;
  tag: string | null;
  notes: string | null;
  targetPrice: number | string | null;
};

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Génère le CSV d'export des tickers d'une watchlist.
export function buildWatchlistCsv(tickers: ExportableTicker[]): string {
  const header = EXPECTED_HEADERS.join(",");
  const lines = tickers.map((ticker) =>
    [
      ticker.symbol,
      ticker.tag ?? "",
      ticker.notes ?? "",
      ticker.targetPrice?.toString() ?? "",
    ]
      .map(escapeCsvField)
      .join(","),
  );

  return [header, ...lines].join("\n") + "\n";
}

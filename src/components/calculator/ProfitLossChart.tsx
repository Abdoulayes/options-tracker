"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  strike: number;
  breakeven: number;
  maxProfit: number;
  maxLoss: number;
};

// Couleurs sémantiques déjà utilisées ailleurs dans l'app pour profit/perte
// (cf. OptionsChainTable — distance au strike) : vert émeraude / rouge
// destructive, indépendantes du thème clair/sombre.
const PROFIT_COLOR = "#10b981";
const LOSS_COLOR = "var(--destructive)";

// P/L à l'expiration pour un prix donné du sous-jacent : fonction affine par
// morceaux, dérivée directement des résultats du calculateur (aucun nouveau
// paramètre requis — cf. yield-calculator.ts, breakeven = strike - prime).
// Entre 0 et strike, la pente vaut (maxProfit + maxLoss) / strike, ce qui
// reproduit exactement (strike - prix) × 100 × contrats sans avoir besoin de
// repasser le nombre de contrats à ce composant.
function profitLossAtPrice(
  price: number,
  strike: number,
  maxProfit: number,
  maxLoss: number,
): number {
  if (price >= strike) {
    return maxProfit;
  }
  const slope = (maxProfit + maxLoss) / strike;
  return maxProfit - (strike - price) * slope;
}

function buildSeries(strike: number, maxProfit: number, maxLoss: number) {
  const priceMax = strike * 1.6;
  const pointCount = 60;
  const points: { price: number; pl: number }[] = [];
  for (let i = 0; i <= pointCount; i += 1) {
    const price = (priceMax / pointCount) * i;
    points.push({
      price,
      pl: profitLossAtPrice(price, strike, maxProfit, maxLoss),
    });
  }
  return points;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { price: number; pl: number } }[];
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const { price, pl } = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="text-muted-foreground">Prix : {formatCurrency(price)}</p>
      <p
        className="font-medium"
        style={{ color: pl >= 0 ? PROFIT_COLOR : LOSS_COLOR }}
      >
        P/L : {formatCurrency(pl)}
      </p>
    </div>
  );
}

// Diagramme Profit/Loss (Lot 5, spec fonctionnelle Module 5). Les points sont
// générés dynamiquement à partir des résultats du calculateur — aucune
// donnée de marché supplémentaire n'est nécessaire.
export function ProfitLossChart({
  strike,
  breakeven,
  maxProfit,
  maxLoss,
}: Props) {
  const data = buildSeries(strike, maxProfit, maxLoss);
  const yMax = maxProfit * 1.15;
  const yMin = -maxLoss * 1.15;
  // Le gradient est réparti selon la valeur Y (0 = frontière profit/perte) :
  // comme la courbe est monotone, cela colore exactement la zone au-dessus
  // du breakeven en vert et celle en dessous en rouge.
  const zeroOffset = Math.min(1, Math.max(0, yMax / (yMax - yMin || 1)));

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-medium text-foreground">
        Profit / Perte à l&apos;expiration
      </h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="pl-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor={PROFIT_COLOR} stopOpacity={0.35} />
                <stop
                  offset={zeroOffset}
                  stopColor={PROFIT_COLOR}
                  stopOpacity={0.05}
                />
                <stop
                  offset={zeroOffset}
                  stopColor={LOSS_COLOR}
                  stopOpacity={0.05}
                />
                <stop offset={1} stopColor={LOSS_COLOR} stopOpacity={0.35} />
              </linearGradient>
              <linearGradient id="pl-stroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor={PROFIT_COLOR} />
                <stop offset={zeroOffset} stopColor={PROFIT_COLOR} />
                <stop offset={zeroOffset} stopColor={LOSS_COLOR} />
                <stop offset={1} stopColor={LOSS_COLOR} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="price"
              type="number"
              domain={[0, strike * 1.6]}
              tickFormatter={(value: number) => formatCurrency(value)}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={(value: number) => formatCurrency(value)}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" />
            <ReferenceLine
              x={breakeven}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{
                value: "Breakeven",
                position: "insideTopLeft",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
            />
            <ReferenceLine
              x={strike}
              stroke="var(--muted-foreground)"
              strokeDasharray="2 4"
              strokeOpacity={0.5}
              label={{
                value: "Strike",
                position: "insideTopRight",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
            />
            <Area
              type="linear"
              dataKey="pl"
              stroke="url(#pl-stroke)"
              strokeWidth={2}
              fill="url(#pl-fill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

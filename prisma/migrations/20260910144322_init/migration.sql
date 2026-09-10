-- CreateEnum
CREATE TYPE "OptionType" AS ENUM ('CSP', 'CC');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TradeOutcome" AS ENUM ('EXPIRED', 'ASSIGNED', 'CLOSED_EARLY', 'ROLLED');

-- CreateEnum
CREATE TYPE "WatchlistTag" AS ENUM ('CORE', 'GROWTH', 'SPECULATIVE', 'BLACKLIST');

-- CreateEnum
CREATE TYPE "DTEPreset" AS ENUM ('WEEKLY', 'BI_WEEKLY', 'STANDARD', 'EXTENDED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('DELTA_TARGET_REACHED', 'IV_RANK_THRESHOLD', 'EARNINGS_IMMINENT', 'GATEWAY_DISCONNECTED');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRIGGERED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultDtePreset" "DTEPreset" NOT NULL DEFAULT 'STANDARD',
    "feePerContract" DECIMAL(10,2) NOT NULL DEFAULT 0.65,
    "targetDeltaMin" DECIMAL(4,3) NOT NULL DEFAULT 0.15,
    "targetDeltaMax" DECIMAL(4,3) NOT NULL DEFAULT 0.30,
    "weeklyRotationDay" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_tickers" (
    "id" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "conid" TEXT,
    "tag" "WatchlistTag",
    "notes" TEXT,
    "targetPrice" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watchlist_tickers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iv_history" (
    "id" TEXT NOT NULL,
    "watchlistTickerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ivRank" DECIMAL(5,2) NOT NULL,
    "ivPercentile" DECIMAL(5,2),
    "underlyingPrice" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iv_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "symbol" TEXT,
    "condition" JSONB NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "optionType" "OptionType" NOT NULL,
    "dtePreset" "DTEPreset" NOT NULL,
    "strike" DECIMAL(12,2) NOT NULL,
    "premium" DECIMAL(12,2) NOT NULL,
    "contracts" INTEGER NOT NULL DEFAULT 1,
    "openDate" TIMESTAMP(3) NOT NULL,
    "closeDate" TIMESTAMP(3),
    "status" "TradeStatus" NOT NULL DEFAULT 'OPEN',
    "outcome" "TradeOutcome",
    "ibkrOpenOrderId" TEXT,
    "ibkrCloseOrderId" TEXT,
    "conid" TEXT,
    "realizedPnl" DECIMAL(12,2),
    "annualizedYieldReal" DECIMAL(7,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_tickers_watchlistId_symbol_key" ON "watchlist_tickers"("watchlistId", "symbol");

-- CreateIndex
CREATE INDEX "iv_history_watchlistTickerId_date_idx" ON "iv_history"("watchlistTickerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "iv_history_watchlistTickerId_date_key" ON "iv_history"("watchlistTickerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "trade_logs_ibkrOpenOrderId_key" ON "trade_logs"("ibkrOpenOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "trade_logs_ibkrCloseOrderId_key" ON "trade_logs"("ibkrCloseOrderId");

-- CreateIndex
CREATE INDEX "trade_logs_userId_status_idx" ON "trade_logs"("userId", "status");

-- CreateIndex
CREATE INDEX "trade_logs_symbol_idx" ON "trade_logs"("symbol");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_tickers" ADD CONSTRAINT "watchlist_tickers_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iv_history" ADD CONSTRAINT "iv_history_watchlistTickerId_fkey" FOREIGN KEY ("watchlistTickerId") REFERENCES "watchlist_tickers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_logs" ADD CONSTRAINT "trade_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

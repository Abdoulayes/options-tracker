generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =========================================
// ENUMS
// =========================================

enum OptionType {
  CSP // Cash Secured Put
  CC  // Covered Call
}

enum TradeStatus {
  OPEN
  CLOSED
}

enum TradeOutcome {
  EXPIRED
  ASSIGNED
  CLOSED_EARLY
  ROLLED
}

enum WatchlistTag {
  CORE
  GROWTH
  SPECULATIVE
  BLACKLIST
}

enum DTEPreset {
  WEEKLY
  BI_WEEKLY
  STANDARD
  EXTENDED
  CUSTOM
}

enum AlertType {
  DELTA_TARGET_REACHED
  IV_RANK_THRESHOLD
  EARNINGS_IMMINENT
  GATEWAY_DISCONNECTED
}

enum AlertStatus {
  ACTIVE
  INACTIVE
  TRIGGERED
}

// =========================================
// USER & SETTINGS
// =========================================

model User {
  id                String   @id @default(cuid())
  email             String   @unique
  passwordHash      String   // bcrypt

  // 2FA (otplib)
  twoFactorSecret   String?  // chiffré AES-256-GCM avant stockage
  twoFactorEnabled  Boolean  @default(false)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  settings          UserSettings?
  watchlists        Watchlist[]
  alerts            Alert[]
  tradeLogs         TradeLog[]

  @@map("users")
}

model UserSettings {
  id                  String    @id @default(cuid())
  userId              String    @unique
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  defaultDtePreset    DTEPreset @default(STANDARD)
  feePerContract      Decimal   @default(0.65) @db.Decimal(10, 2)
  targetDeltaMin      Decimal   @default(0.15) @db.Decimal(4, 3)
  targetDeltaMax      Decimal   @default(0.30) @db.Decimal(4, 3)
  weeklyRotationDay   Int       @default(5) // 1 = lundi ... 5 = vendredi

  createdAt           DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@map("user_settings")
}

// =========================================
// WATCHLIST
// =========================================

model Watchlist {
  id          String            @id @default(cuid())
  userId      String
  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  name        String

  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  tickers     WatchlistTicker[]

  @@map("watchlists")
}

model WatchlistTicker {
  id              String        @id @default(cuid())
  watchlistId     String
  watchlist       Watchlist     @relation(fields: [watchlistId], references: [id], onDelete: Cascade)

  symbol          String
  conid           String?       // identifiant IBKR résolu (contract id)
  tag             WatchlistTag?
  notes           String?       @db.Text
  targetPrice     Decimal?      @db.Decimal(12, 2)

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  ivHistory       IVHistory[]

  @@unique([watchlistId, symbol])
  @@map("watchlist_tickers")
}

// =========================================
// IV HISTORY
// =========================================

model IVHistory {
  id                  String          @id @default(cuid())
  watchlistTickerId   String
  watchlistTicker     WatchlistTicker @relation(fields: [watchlistTickerId], references: [id], onDelete: Cascade)

  date                DateTime        @db.Date
  ivRank              Decimal         @db.Decimal(5, 2)
  ivPercentile        Decimal?        @db.Decimal(5, 2)
  underlyingPrice     Decimal?        @db.Decimal(12, 2)

  createdAt           DateTime        @default(now())

  @@unique([watchlistTickerId, date])
  @@index([watchlistTickerId, date])
  @@map("iv_history")
}

// =========================================
// ALERTS
// =========================================

model Alert {
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  type        AlertType
  symbol      String?     // nullable pour les alertes non liées à un ticker (ex: GATEWAY_DISCONNECTED)
  condition   Json        // ex: { "deltaTarget": 0.20 } ou { "ivRankThreshold": 70 }
  status      AlertStatus @default(ACTIVE)

  lastTriggeredAt DateTime?

  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@map("alerts")
}

// =========================================
// TRADE LOG
// =========================================

model TradeLog {
  id                  String        @id @default(cuid())
  userId              String
  user                User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  symbol              String
  optionType          OptionType
  dtePreset           DTEPreset

  strike              Decimal       @db.Decimal(12, 2)
  premium             Decimal       @db.Decimal(12, 2)
  contracts           Int           @default(1)

  openDate            DateTime
  closeDate           DateTime?

  status              TradeStatus   @default(OPEN)
  outcome             TradeOutcome?

  // Synchronisation automatique via historique d'ordres IBKR (section 9.4)
  ibkrOpenOrderId      String?      @unique
  ibkrCloseOrderId     String?      @unique
  conid                String?      // identifiant IBKR du contrat d'option

  realizedPnl          Decimal?     @db.Decimal(12, 2)
  annualizedYieldReal  Decimal?     @db.Decimal(7, 4)

  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt

  @@index([userId, status])
  @@index([symbol])
  @@map("trade_logs")
}
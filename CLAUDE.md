# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project status

**Lot 0 (project skeleton) is complete.** The project now uses the `src/` layout from `docs/2-spec-technique.md` section 3 (`src/app`, `src/components`, `src/lib`, etc., with empty domain folders tracked via `.gitkeep`), Prisma is wired up against the full schema in `prisma/schema.prisma` (all entities, one initial migration), `docker-compose.yml` defines local Postgres 16, and shadcn/ui + Tailwind are configured with the dark theme applied by default in the root layout.

**Lot 1 (application auth: NextAuth + TOTP 2FA) is complete and merged.**

**Lot 2 (minimal IBKR Gateway client: status & heartbeat) is complete and merged.** Validated manually against the Client Portal Gateway (`clientportal.gw`) on Paper Trading, not the classic IB Gateway/TWS desktop app — those are different IBKR products; this app only ever talks REST/HTTPS to the Client Portal Gateway, never the TWS socket API.

**Lot 3 (Watchlist CRUD, ticker search, CSV import/export) is complete and merged.**

**Lot 4 (market data & options chain) is implemented on `feature/lot-4-options-chain`, manually validated by the user across several watchlist tickers (CD, CDE, PYPL, MSFT, GOOG).** Notable corrections made during manual validation, all driven by real Gateway behavior rather than the CPAPI docs alone:
- `/iserver/marketdata/snapshot` only populates requested fields from the **second** call onward for a given conid (the first call just primes the subscription) — `src/lib/market-data/snapshot.ts` always calls it twice.
- The Gateway rate-limits aggressively in practice (429s observed well under the ~10 req/s figure floated in earlier docs, especially on `/iserver/secdef/info`) — options-chain resolution is capped to the 16 strikes nearest the current price, resolved strictly sequentially with a delay between calls, with retry-with-backoff on 429 in `callGateway` (`src/lib/ibkr-gateway/client.ts`).
- An IBKR options "month" (e.g. `SEP26`) can bundle several distinct real expiration dates when the underlying has weekly options — confirmed live on CDE (two Fridays under one month). `getOptionsChain` groups contracts by their actual `maturityDate` rather than by month, and the UI shows a secondary "Échéance" selector when a month resolves to more than one date.
- **Known open item, not a code bug**: the IV and Open Interest columns are frequently empty. Diagnosed live against the Gateway outside US market hours — the raw snapshot response omits those fields entirely (not just null) whenever the underlying has no active trading session, along with volume on illiquid contracts. The field ids used (`MARKET_DATA_FIELD_IDS.impliedVolatility` = `"7283"`, `.openInterest` = `"7633"` in `client.ts`) are unverified during live market hours — re-check them against a real snapshot taken while the US market is open, and correct if still empty.

Options chain requests intentionally do **not** poll/auto-refresh (`src/hooks/use-options-chain.ts`) — rebuilding a chain is expensive (many Gateway calls) and periodic refetching was the main source of 429s during validation.

**Deviations from the specs, decided explicitly for this project (not to be second-guessed in later lots):**
- The scaffold runs **Next.js 16 / React 19 / Tailwind v4** (already installed) rather than the spec's Next 14 / Tailwind 3 target — kept because it's a newer superset of what's needed, not downgraded.
- **Prisma 7.10.0** is used (per explicit user instruction, after first trying 6.19.3 to avoid this). Prisma 7 removed the classic `datasource { url = env(...) }` syntax from `schema.prisma` — the connection URL now lives in `prisma.config.ts` (loaded via `prisma/config`'s `defineConfig`/`env`), and the `PrismaClient` at runtime is constructed with a driver adapter (`@prisma/adapter-pg`'s `PrismaPg`, see `src/lib/prisma.ts`) instead of reading the datasource URL directly. `schema.prisma`'s `datasource` block therefore only declares `provider = "postgresql"` — this one line removal was unavoidable to run on Prisma 7 at all, everything else in the provided schema is untouched. `prisma.config.ts` loads `.env.local` itself (via `process.loadEnvFile`) since the Prisma CLI only auto-loads `.env` by default, not Next.js's `.env.local`.
- **`docker-compose.yml` maps Postgres to host port 5433, not 5432** — this machine already runs a native Postgres (`brew services`) bound to 5432, which was silently swallowing connections meant for the container. `.env.local.example`'s `DATABASE_URL` uses 5433 accordingly. If you move to a machine without that conflict, both can revert to 5432.
- **The Client Portal Gateway runs on port 5001, not its default 5000** — on this machine, port 5000 is bound by macOS's own AirPlay Receiver (ControlCenter), causing the Gateway to fail at startup with "Server listen failed / Address already in use". Fixed by setting `listenPort: 5001` in the Gateway's own `root/conf.yaml` (outside this repo); `IBKR_GATEWAY_URL` in `.env.local`/`.env.local.example` is set to `https://localhost:5001` accordingly. If you move to a machine without that conflict, both can revert to port 5000 (update `conf.yaml` and `IBKR_GATEWAY_URL` together).

**Read `docs/` before implementing anything** — it is the source of truth for scope and design, not just background reading:

- `docs/1-spec-fonctionnelle.md` — functional spec (features, data entities, UX, security model)
- `docs/2-spec-technique.md` — technical spec (target architecture, folder layout, API surface, financial calculation requirements, testing strategy)
- `docs/3-decoupage-par-lots.md` — the work is broken into sequential "lots" (batches), each with an explicit scope, exclusions, and acceptance criteria. Lot order/dependencies matter (see the dependency diagram at the end of the file) — don't implement a later lot's scope early. Note: this file scopes Lot 0's Prisma schema to `User`/`UserSettings` only, but the full schema was integrated as-is per explicit user instruction — later lots' "add model X" scope items are effectively already satisfied at the schema level, only the endpoints/UI/services remain.
- `docs/4-conventions.md` — code conventions (below)

## What this app is

A single-user web tool for the options "Wheel" strategy (Cash Secured Puts / Covered Calls), pulling live data from Interactive Brokers via the **Client Portal Gateway** (a local Java process, never called directly from the browser — always through Next.js API routes). Analysis only, no order execution. Two independent auth layers: NextAuth + mandatory TOTP 2FA for the app itself, and IBKR's own login/2FA for the Gateway.

Deployment is staged: local-only (Phase 1, Docker Postgres) → Neon-hosted DB (Phase 2) → Vercel + Neon + IBKR Gateway on a dedicated VPS (Phase 3). Because of this, **no environment-dependent value (DB URL, Gateway URL, account id) may be hardcoded** — everything goes through a single centralized config module reading env vars.

## Conventions (docs/4-conventions.md)

| Aspect | Convention |
|---|---|
| Code language (vars/functions) | English |
| Comment language | French |
| React component files | PascalCase (`OptionsChainTable.tsx`) |
| Utility files | kebab-case (`calculate-yield.ts`) |
| Linting | ESLint (Next.js default config) + Prettier |
| Import alias | `@/` → `src/` (once the `src/` layout is adopted) |
| Git | One branch per lot: `feature/lot-N-nom-du-lot`, merged to `main` only after that lot's acceptance criteria are met |

## Key architectural rules (non-negotiable per spec)

- No direct browser → IBKR Gateway calls, and no direct browser → DB calls. Everything routes through Next.js API routes → a service layer → Prisma / the Gateway HTTP client.
- The IBKR Gateway's self-signed TLS cert is only ever accepted when `NODE_ENV` is explicitly development — never relax cert validation in production.
- Financial calculations (yield, break-even, DTE, the 45-21 management rule, DTE-preset recommendation logic) must live in pure functions with no I/O, under `lib/domain-services/`, and ship with near-exhaustive unit tests in the same lot that introduces them (see Lot 5 in `docs/3-decoupage-par-lots.md`).
- The 2FA TOTP secret is AES-256-GCM encrypted at rest and only decrypted transiently during verification — never logged, never stored in plaintext.
- No financial amounts, positions, or secrets in application logs.

## Commands

```bash
npm run dev              # Next.js dev server
npm run build            # production build
npm run start            # run production build
npm run lint             # ESLint
npm run format           # Prettier — write
npm run format:check     # Prettier — check only
npm run prisma:generate  # regenerate the Prisma client
npm run prisma:migrate   # create/apply a dev migration (needs DATABASE_URL, e.g. via docker-compose)
npm run test             # run the full Vitest suite once
npm run test:watch       # Vitest in watch mode
```

Integration tests (`tests/integration/`) hit the local Postgres from `docker-compose.yml` — start it first.

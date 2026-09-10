# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project status

**Lot 0 (project skeleton) is complete.** The project now uses the `src/` layout from `docs/2-spec-technique.md` section 3 (`src/app`, `src/components`, `src/lib`, etc., with empty domain folders tracked via `.gitkeep`), Prisma is wired up against the full schema in `prisma/schema.prisma` (all entities, one initial migration), `docker-compose.yml` defines local Postgres 16, and shadcn/ui + Tailwind are configured with the dark theme applied by default in the root layout. No business logic, auth, or IBKR integration exists yet — that starts at Lot 1.

**Deviations from the specs, decided explicitly for this project (not to be second-guessed in later lots):**
- The scaffold runs **Next.js 16 / React 19 / Tailwind v4** (already installed) rather than the spec's Next 14 / Tailwind 3 target — kept because it's a newer superset of what's needed, not downgraded.
- **Prisma 7.10.0** is used (per explicit user instruction, after first trying 6.19.3 to avoid this). Prisma 7 removed the classic `datasource { url = env(...) }` syntax from `schema.prisma` — the connection URL now lives in `prisma.config.ts` (loaded via `prisma/config`'s `defineConfig`/`env`), and the `PrismaClient` at runtime is constructed with a driver adapter (`@prisma/adapter-pg`'s `PrismaPg`, see `src/lib/prisma.ts`) instead of reading the datasource URL directly. `schema.prisma`'s `datasource` block therefore only declares `provider = "postgresql"` — this one line removal was unavoidable to run on Prisma 7 at all, everything else in the provided schema is untouched. `prisma.config.ts` loads `.env.local` itself (via `process.loadEnvFile`) since the Prisma CLI only auto-loads `.env` by default, not Next.js's `.env.local`.
- **`docker-compose.yml` maps Postgres to host port 5433, not 5432** — this machine already runs a native Postgres (`brew services`) bound to 5432, which was silently swallowing connections meant for the container. `.env.local.example`'s `DATABASE_URL` uses 5433 accordingly. If you move to a machine without that conflict, both can revert to 5432.

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
```

There is no test runner configured yet — that needs to be set up per `docs/2-spec-technique.md` section 14 (introduced alongside the first testable logic, in Lot 5 at the latest).

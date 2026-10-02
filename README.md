# StockFlow Inventory Management System

StockFlow is a general-purpose inventory, purchasing, sales, payment, expense, and party-ledger system for a trading business.

Repository status: **Phase 2 complete and deployed; Phase 3 and Miscellaneous Expenses implemented, production deployment pending**. The project owner confirmed the deployed Phase 2 baseline on 2026-10-01. Phase 3 adds sales invoice drafts/posting, immutable FIFO allocations, customer receipts/advances and ledger screens, and original-cost sale returns. The Expenses module adds operating-expense categories, append-only posting, audited voiding, filtering, and reporting-ready totals without changing inventory or FIFO costs. Full analytics and reporting remain deferred; Phase 3 and Expenses have not been deployed to production.

## Foundation documentation

- [Requirements baseline](docs/requirements.md)
- [Database design](docs/database-design.md)
- [Development plan](docs/development-plan.md)
- [Authentication preparation](docs/authentication.md)
- [Prisma schema](prisma/schema.prisma)
- [Repository guidance](AGENTS.md)

## Prerequisites and local setup

- Node.js 22.18 or newer
- npm (use the lockfile with `npm ci`)
- Access to the approved Supabase development project

Copy `.env.example` to the ignored `.env`, add the development connection values, then install and run the minimal application shell:

```text
npm ci
npm run dev
```

Generate a unique high-entropy `AUTH_SECRET`, set `BETTER_AUTH_URL=http://localhost:3000`, and keep both server-only. Create the first business owner only through the one-time bootstrap command:

```text
STOCKFLOW_ADMIN_NAME="Business Owner"
STOCKFLOW_ADMIN_EMAIL="owner@example.com"
STOCKFLOW_ADMIN_PASSWORD="a long unique password"
npm run admin:bootstrap
```

On PowerShell, set those three values as process environment variables before running the command. Remove them immediately afterward. The command never prints the password and refuses to create a bootstrap Admin once any Admin exists. StockFlow has no self-registration screen.

Authenticated routes include `/`, `/products`, `/categories`, `/units`, `/suppliers`, `/customers`, `/purchases`, `/supplier-payments/new`, `/sales`, `/customer-ledger`, `/customers/[id]/account`, and `/customer-receipts/new`; `/login` is public. All authenticated roles may view master data and Phase 2/3 records. Only `ADMIN` may mutate master data; active `ADMIN` and `MANAGER` users may create and post operational transactions.

Use `npm run build` for a production build and `npm start` to serve that build. The standard repository verification command is `npm run check`; database-backed verification additionally uses `npm run db:migrate:status`, `npm run db:verify`, and `npm run test:integration`.

## Cloud development database

Supabase-managed PostgreSQL is the supported development database. Create an ignored root `.env` from `.env.example` and copy the exact connection strings from the Supabase Connect panel:

- `DATABASE_URL`: transaction-pooler connection used by the running Next.js/Prisma application, including Vercel serverless workloads.
- `DIRECT_URL`: direct or session-pooler connection used by Prisma CLI, migration, seed, verification, and database administration commands.

Both variables are server secrets. Never use a `NEXT_PUBLIC_` prefix, print complete URLs, or commit credentials. `prisma.config.ts` deliberately reads `DIRECT_URL`; the Prisma singleton deliberately reads `DATABASE_URL`. The integration suite also requires `STOCKFLOW_DATABASE_TARGET=development-disposable` as an explicit safety acknowledgement.

After configuring the disposable `stockflow-dev` project, run:

```text
npm run db:connectivity
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
npm run db:migrate:deploy
npm run db:seed
npm run db:seed
npm run db:verify
npm run test:integration
npm run db:migrate:status
```

The reviewed baseline is [the initial migration](prisma/migrations/20260930000100_init/migration.sql). It was generated from an empty database and already incorporates `prisma/sql/initial-integrity-constraints.sql`. Phase 1B adds `20260930020000_phase_1b_auth_master_data` for Better Auth tables and User compatibility. Phase 2 adds `20260930030000_phase_2_transaction_guardrails` for purchase-return uniqueness, typed source semantics, purchase-total reconciliation, allocation limits, and return source matching. Do not execute the supplement separately, use `prisma db push`, or edit applied migrations.

`prisma migrate dev` needs a shadow database for future schema changes. Use it only with a development role that can create the shadow database or with an explicitly configured disposable shadow database. Applying the already-reviewed initial migration to a clean development project uses `prisma migrate deploy` and does not need a shadow database.

Docker is optional fallback tooling only. To use it, copy `.env.docker.example` to the ignored `.env.docker` and use the `db:local:*` scripts. The guarded recreation script accepts only the localhost `stockflow_dev` database and must never be adapted to reset Supabase.

The initial migration was applied to the authorized development Supabase project on 2026-09-30. Migration status, database catalog verification, two seed executions, seed idempotency, and all ten database integration tests passed.

## Vercel and GitHub deployment

The supported flow is feature branch → GitHub push/pull request → Vercel Preview → review/test → merge to `main` → Vercel Production. Preview variables point to `stockflow-dev`; Production variables point to an independent `stockflow-prod` project. Migration files move through Git, never database contents.

Set `DATABASE_URL` and `DIRECT_URL` independently in Vercel Preview and Production environments. Add `AUTH_SECRET` only when authentication is introduced. Vercel builds generate Prisma Client, but neither builds nor application startup apply migrations.

Production migrations use the manual, protected GitHub Actions workflow in `.github/workflows/deploy-production-database.yml`. Store the production `DIRECT_URL` in the protected `production` GitHub Environment, require reviewer approval, and run the workflow only after the committed migration has passed against development. See [Cloud deployment](docs/cloud-deployment.md).

## Dependency audit

The 2026-09-30 `npm audit` reports four high-severity advisories through Prisma 7.10 CLI/config transitive dependencies (`deepmerge-ts` and `mysql2`). npm's proposed automatic remediation is a breaking downgrade to Prisma 6. `npm audit fix --force` must not be used; retain Prisma 7 and review again when a compatible patched release is available.

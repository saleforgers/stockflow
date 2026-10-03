# StockFlow Cloud Deployment

The `stockflow-dev` activation was verified on 2026-09-30: the initial migration, catalog verification, two idempotent seed runs, and database integration suite all passed. Credentials remain only in the ignored local environment file.

## Environment separation

| Target                               | Database                                      | Runtime connection                | Migration connection               |
| ------------------------------------ | --------------------------------------------- | --------------------------------- | ---------------------------------- |
| Local development and Vercel Preview | `stockflow-dev` Supabase project              | `DATABASE_URL` transaction pooler | `DIRECT_URL` direct/session pooler |
| Vercel Production                    | independent `stockflow-prod` Supabase project | `DATABASE_URL` transaction pooler | `DIRECT_URL` direct/session pooler |

Project identifiers and credentials are environment values only. Do not copy development business data to production, point Preview at production by default, or expose either URL with `NEXT_PUBLIC_`.

## Initial development activation

1. Confirm the Supabase project is explicitly disposable and contains no real/production data.
2. Copy `.env.example` to ignored `.env`, use the exact URLs from the project Connect panel, and set `STOCKFLOW_DATABASE_TARGET=development-disposable` only after verifying this is the disposable development project.
3. Run `npm run db:connectivity`; it reports only database/user/version metadata, never a URL or password.
4. Run Prisma format, validation, and generation.
5. Review `prisma/migrations/20260930000100_init/migration.sql`. The approved integrity supplement is already appended.
6. Run `npm run db:migrate:deploy`, then `npm run db:migrate:status` and `npm run db:verify`.
7. Run the seed twice and the database integration suite. Repeated seeding must not create duplicates.

Do not run `prisma migrate reset` unless the exact target has been independently verified as disposable. A shared or production Supabase database is never a reset target.

## Future migration development

`prisma migrate dev` requires a shadow database. Use a CREATEDB-capable development-only role only when that privilege is intentionally granted, or configure a separate disposable shadow database. Never use production as a shadow database. An alternative migration-generation process must still produce reviewed, committed SQL; `prisma db push` is not a substitute.

## Vercel

Connect the GitHub repository to Vercel and use Git-based deployments. Configure `DATABASE_URL` and `DIRECT_URL` separately for Preview and Production. Phase 1B also requires a unique high-entropy `AUTH_SECRET` and the environment's canonical HTTPS `BETTER_AUTH_URL`; both are server-only and must differ where isolation warrants it. Prisma Client generation occurs during install/build; migrations and seeds do not. Serverless function compute regions are configured via `vercel.json` (`hnd1` Tokyo) to co-locate compute with the Supabase database (`ap-northeast-1`).

## Production migrations

The workflow `.github/workflows/deploy-production-database.yml` is manual and targets a protected GitHub `production` Environment. Store only the production `DIRECT_URL` as an environment secret, enable required reviewers, and run it after the migration succeeds against development. The workflow validates Prisma and runs `prisma migrate deploy`; it does not seed or reset the database.

## Client demo release — 2026-10-03

The inventory/documents/reporting upgrade was released from implementation commit `27532cd8f21f2ac5659b48e2da8b185c68b9e3f5`. The protected [migration run](https://github.com/saleforgers/stockflow/actions/runs/37092849451) succeeded and reported eight migrations with none pending. The existing Git-linked Vercel production deployment reached Ready and serves [the canonical production application](https://stockflow-brown-mu.vercel.app). Production login and authorization checks passed; authenticated business workflow checks were performed in development only. See [the delivery record](client-demo-upgrade.md) for verification, additive migrations, deferred features and configuration limitations.

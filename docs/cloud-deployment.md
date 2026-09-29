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

Connect the GitHub repository to Vercel and use Git-based deployments. Configure `DATABASE_URL` and `DIRECT_URL` separately for Preview and Production. Add `AUTH_SECRET` only with the later authentication implementation. Prisma Client generation occurs during install/build; migrations and seeds do not.

## Production migrations

The workflow `.github/workflows/deploy-production-database.yml` is manual and targets a protected GitHub `production` Environment. Store only the production `DIRECT_URL` as an environment secret, enable required reviewers, and run it after the migration succeeds against development. The workflow validates Prisma and runs `prisma migrate deploy`; it does not seed or reset the database.

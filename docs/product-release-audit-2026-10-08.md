# StockFlow delivery audit — 2026-10-08

The owner approved the expense/invoice designs and authorized production deployment without further confirmation. This release preserves the existing requirements and core implementation; only the approved entry/detail presentation and form-value retention change.

## Compatibility review

- Compared the release against the deployed `b6b309575d4bd9003c83c488f3eb2f90e85bb523` baseline. Prisma schema/migrations, posting services, server actions, queries, validation, Decimal/FIFO calculations, auth/session configuration, payment controls, ledgers, inventory history, reports, PDF generation, master data, estimates and returns have no source changes.
- TypeScript syntax-tree comparison confirms the sales/purchase form state, payload construction and totals logic, and all three detail pages' authorization/query/calculation logic are unchanged before rendering.
- Protected layout checks the persistent session. Master-data mutations repeat ADMIN authorization; purchases, sales, inventory, expenses and estimates repeat ADMIN/MANAGER authorization. PDF and statement handlers check authentication. These guards are preserved.
- Inspected existing transactional posting, row locks, idempotency/request keys, posted-document edit restrictions and walk-in payment rules. No business policy, sequence, ledger allocation, stock allocation or cost formula was altered.
- Existing purchase receiving lots and received timestamps remain in the submitted payload. Purchase detail columns now correctly identify gross price, discount, net cost, amount and available quantity.

## Verification

- Fresh `npm run check` passed: formatting, lint, TypeScript, all 53 existing unit tests across 19 files and Prisma validation. A fresh optimized production build also passed before release.
- Desktop/mobile browser verification covered actual entry components with synthetic data: product search and keyboard selection, add/remove lines, multiple receiving lots, notes, validation messages and failed-submission value retention. Credit/partial/walk-in payment controls and estimate rendering were verified without database writes. Actual detail-page rendering used mocked queries.
- The protected [read-only schema verification](https://github.com/saleforgers/stockflow/actions/runs/37692040335) passed: all 10 migrations, matching checksums, purchase discount columns, and no unresolved failed migration. No migrations were applied for this release.

## Deployment and practical limits

- Release to the existing GitHub main/Vercel production project and verify the canonical application, deployment source revision, aliases, protected routes, authentication endpoint and built static assets after rollout. The prior ready deployment is `dpl_5o3eYU5yhsyHX39DZCX64Euh1GgA` (`stockflow-hwgl6j3lw-sale-forgers.vercel.app`) for application rollback.
- The migration workflow and local connection still share fingerprint `5e3cc58988f67ad6`. Runtime-versus-development isolation remains unconfirmed, so integration fixtures, seed, reset and cleanup are excluded. This release changes no database URLs or environment settings.
- Previous focused database acceptance covered 28 purchase/sale/history cases; it is historical evidence and was not rerun on the unconfirmed shared target. No production business transaction is posted as a smoke test.
- No authenticated owner browser session was available at release preparation. Live unauthenticated route/asset checks establish availability and access guards, not completion of every authenticated business workflow. The audit does not guarantee untested workflows.

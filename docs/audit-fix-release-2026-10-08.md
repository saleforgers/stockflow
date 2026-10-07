# Audit corrections — 2026-10-08

The owner authorized fixing the deployment audit findings and releasing the corrections to the existing production application.

## Decisions before implementation

- Product history uses recorded creation order, matching the existing movement audit. Its balance is scoped to the default inventory location, matching the displayed current stock.
- Sales payment choices use the already approved Paid, Credit, and Partial rules: Paid follows the invoice total, Credit records no receipt, and Partial requires a positive amount below the total. Walk-in sales require Paid. No posting, ledger, cost, or discount policy is changed.
- Draft saving remains possible without a payment method. Finalization validates payment choice on the server.
- Production schema checks are read-only. Existing migrations will only run through the controlled production workflow after development verification. No business acceptance fixtures are written to production.

## Verification

- Format, lint, TypeScript, 53 unit tests, Prisma validation, and optimized Next.js build passed. The local environment lacked AUTH_SECRET; the build used a fresh, process-only local secret, without changing production authentication.
- The existing October 6 migration was missing from development. It was applied with Prisma migrate deploy. The read-only checker confirms all 10 committed migrations, matching checksums, no unresolved failed migration, and all three required PurchaseLine columns.
- Focused database acceptance: 28 cases passed across purchases, sales, product opening stock/history, and read-only movement balances. Two multi-command sales cases initially exceeded the 30-second test harness limit; both passed when rerun with the integration-only 90-second limit. Posting transaction timeouts remain unchanged. The new history regression posts a future-dated development receipt before a sale and verifies running quantities 5 then 4.
- Formatting differences were normalized. Ignored tmp/output artifacts are excluded from formatting, linting, and TypeScript to keep audit snapshots out of checks.
- The PostgreSQL driver still emits a query concurrency deprecation warning in integration tests; no financial/stock assertion failed. It is not a failed posting or a production schema verdict.

## Production release status

Vercel sensitive environment exports contained empty values for DATABASE_URL/AUTH_SECRET/BETTER_AUTH_URL. No usable production connection was retrieved. The temporary environment export was deleted. Runtime/migration database identity remains unconfirmed.

Added a protected, manual read-only production schema verification workflow, and a schema verification step after the existing production migration workflow. These query only migration/column metadata and never print credentials or business records.

The owner explicitly authorized production deployment on October 8. The existing protected [migration workflow](https://github.com/saleforgers/stockflow/actions/runs/37683386153) was dispatched against reviewed commit `90c82df` before publishing the application fixes. Production readiness and deployment results are recorded after the release completes.

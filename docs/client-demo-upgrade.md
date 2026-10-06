# Client demo upgrade — 2026-10-03

The owner authorized inventory usability, adjustments, documents, management reporting, expenses, estimates, and controlled production deployment in this implementation request. This supersedes earlier phase restrictions for these modules only.

## Implementation decisions

- Reuse existing FIFO, payment, return, ledger and authorization services. No new inventory location or independent stock/ledger balance.
- On hand comes from signed movements; valuation is the sum of remaining lot quantity multiplied by its recorded cost. The displayed average cost is valuation divided by remaining layer quantity.
- Count adjustments compare the displayed quantity with the transaction's current quantity. Concurrent changes require a refreshed count. Reductions consume FIFO layers; additions require a positive business-approved unit cost. Damage/loss may only reduce stock. Returns continue to restock original lots; no unsupported no-restock/refund flow is introduced.
- Invoices use existing payment methods. Credit means no payment now, rather than a new payment method record. Due dates are omitted because the existing invoice model does not support them.
- Document company details use centralized server environment configuration. No invented phone, address, tax number or logo.
- P&L uses finalized invoice totals less returns on their respective business dates, and original allocation costs less original-cost return allocations. Purchases are not expenses. Stock adjustment losses are disclosed separately from sales COGS and operating expenses.
- Expenses remain paid, immutable records corrected by the existing cancellation/replacement workflow.

## Delivery status

Implemented P0, P1 and the core P2 estimate workflow:

- Business-facing product rows, stock warnings, live decimal totals, draft/finalize actions, payment-aware invoice status, payment history and expandable stock-used detail.
- Inventory overview, accurate remaining-layer valuation, low-stock filtering, product inventory cards, lots, linked stock movements with running balances and auditable stock counts.
- Customer and supplier accounts with summary cards, date-filtered paginated statements, opening/closing balances and server-generated A4 PDFs. Existing customer advance application remains available separately.
- Existing expense entry, cancellation/replacement and filtering retained. Utilities and Other defaults added without replacing existing categories.
- Management P&L, sales/purchase reports, receivables/payables and report links to inventory/expense reports; useful dashboard totals, low-stock items and recent business documents.
- Estimates with validated item snapshots, statuses, PDFs and atomic, retry-safe conversion into a draft invoice. Estimates never reserve stock or write account/COGS records. Numbers use a new independent `EST` sequence.

New migrations: `20261003020000_stock_adjustment_guardrails`, `20261003030000_expense_category_defaults`, `20261003040000_estimates`. The earlier committed expense migration was also applied to development. All are additive; existing history is retained.

Routes: `/inventory`, `/inventory/lots`, `/inventory/movements`, `/inventory/low-stock`, `/inventory/adjust`, `/inventory/adjustments/[id]`, `/reports`, `/reports/profit-loss`, `/reports/{sales,purchases,receivables,payables}`, `/estimates`, `/estimates/new`, `/estimates/[id]`, `/estimates/[id]/edit`, `/estimates/[id]/pdf`, `/sales/[id]/pdf`, `/customers/[id]/account/pdf`, `/suppliers/[id]/account/pdf`, `/customers/[id]/advances`.

Validation: all 31 unit tests and 15 focused database acceptance tests passed. Typecheck and production build passed. Development schema comparison reports no difference. Authenticated development smoke checks passed for 25 routes including every PDF type; unauthenticated inventory redirects to login. A multi-page invoice PDF was rendered and visually inspected.

Intentionally deferred: invoice due dates (not in the existing model), damaged returns without restocking, cash-refund UI, percentage discount entry, arbitrary non-Western PDF fonts, and a business-settings editor. Branding is available through documented `BUSINESS_*` environment values; default branding remains StockFlow until owner details are supplied. The PDF export limit is 10,000 statement entries per date range. No statutory accounting, tax, multi-location or landed-cost workflows were added.

## Production release

Implementation commit `27532cd8f21f2ac5659b48e2da8b185c68b9e3f5` was pushed to the existing `main` branch.

The existing protected [production migration workflow](https://github.com/saleforgers/stockflow/actions/runs/37092849451) succeeded against that commit on 2026-10-03. Prisma found all eight committed migrations and reported **no pending migrations to apply**; the run did not apply additional SQL. Database environment values remain owner-managed; the Vercel runtime database identity was not independently compared with the workflow connection.

The existing Vercel project's Git-triggered production deployment `dpl_DgRy2Aw6VV5JVMpBVaZ2uHQZT3qr` reached **Ready**. Build logs confirmed commit `27532cd`; [StockFlow production](https://stockflow-brown-mu.vercel.app) points to this release. The configured Tokyo compute region was retained. No preview environment, production seed, reset, or business test transaction was created.

Concise production checks: `/login` returned 200; inventory, invoices, expenses, reports, P&L, estimates and stock adjustment pages redirected unauthenticated requests to login; invoice/customer-statement/estimate PDF routes returned 401 without a session. Authenticated workflows were verified against the configured development database, not against production. An authenticated owner review remains the final production workflow check.

## Follow-up: cleanup, visual hierarchy and PDF preview

The owner requested a safe way to remove the automated fixtures, clearer colors/numbers/arrows, and preview/print before PDF download. The Admin-only **Demo Data Cleanup** navigation opens `/settings/data-cleanup`, with an exact fixture preview, JSON backup download, external-link blockers and typed confirmation. Completed cleanups retain private append-only backups. This removes recognized automated acceptance fixtures only; arbitrary real business documents retain their existing integrity protections. No cleanup is automatically executed on deployment. The cleanup integration test deliberately rolls the complete transaction back after proving deletion, backup, retry, authorization and trigger restoration.

Dashboard numbers are grouped into business performance and account/stock alerts. Green income, rose costs/losses, indigo stock and amber warnings show meaning consistently; arrow labels describe actual flow, not invented comparison percentages. The same summaries are used on invoice, account, product and P&L pages. Movements and account entries distinguish increases/decreases with arrows and accessible labels. Invoice totals have a clearer visual hierarchy.

Invoices, estimates and account statements now open an in-page PDF dialog. The server PDF is fetched and validated before displaying it. A lazy-loaded, pinned Mozilla PDF.js renderer with a self-hosted worker renders pages independently of native browser PDF support. Download uses the exact previewed bytes; Print renders the actual PDF pages on A4 paper instead of printing the application page. Page navigation keeps long statement previews bounded; documents exceeding 100 print pages use downloaded-PDF printing or a smaller date range. Inline/new-tab viewing remains available, with explicit generation/session errors. The worker is copied during existing install/build steps; no CDN or external document service receives invoice data.

New migration: `20261003050000_demo_cleanup_archive`. Verification: 33 unit tests, rolled-back cleanup database acceptance, lint, typecheck, Prisma validation/schema comparison and production build passed. Authenticated local browser review confirmed dashboard spacing/colors, the cleanup preview with no business links, and the actual A4 invoice rendered in the PDF dialog. The temporary auth-only QA account and sessions are removed after verification. Production release uses the existing protected migration workflow and Git-linked Vercel project; no demo removal is automatically run by this release.

Follow-up implementation commit `d8eee6453bf4bc02e70ad8a3dc02a89a3a94dd09` was pushed to `main`. The existing protected [migration workflow](https://github.com/saleforgers/stockflow/actions/runs/37119537121) succeeded and found all nine migrations with none pending. Production deployment `dpl_EKXrvavso7oAPYpRwpNgbUVhjmzu` reached Ready and the canonical application points to the updated release. Six concise public production checks passed: login 200, cleanup/inventory redirect to login, backup/invoice PDF reject unauthenticated access, and the self-hosted PDF worker returns 200 with JavaScript MIME type. Business data was not written or removed by production smoke checks. The temporary local QA account and its sessions were deleted after browser verification.

## Authenticated production demo verification

The owner supplied an existing authenticated production browser session. Live checks covered dashboard calculations, stock and remaining-lot valuation, product lots/movements, purchase/supplier relationships, invoice product selection and decimal totals, single-row and combined-row insufficient-stock warnings, existing finalized invoice deduction/payment history, customer/supplier accounts and all four PDF previews. Expense entry/categories, P&L date filters, sales/purchase reports, receivables/payables and low-stock reporting were also inspected. A count form correctly calculated a reduction without submitting it.

Three presentation issues were corrected: movement running balances used receiving/business timestamps that could place an issue before its recorded receipt; balances and table ordering now both use the audit entry's recorded creation order. Purchase payment badges now use the existing human-readable labels. The unrelated Active/Inactive status filter was removed from Purchases, leaving its Draft/Finalized/Cancelled document filter; master-data filters retain their existing behavior. No movements, allocation costs, payments, ledger history, posting services or database schema were changed.

Existing test quotation `EST-000004` contained a removed automated test product. That draft was explicitly labelled `DEMO / TEST`, updated to a current product and converted once into draft invoice `INV-000034`. Its PDF rendered correctly. The invoice remains unfinalized; dashboard totals, inventory valuation and the walk-in customer ledger were unchanged afterward. No genuine invoice, payment, expense, return or stock adjustment was posted for this verification.

Validation passed: typecheck, lint, all 33 unit tests, production build and two stock-balance SQL regression tests. The new regression tests use only SELECT fixtures in explicitly read-only transactions, including future receipt dates, backdated returns, exact fractional quantities and filtered history balances; they do not seed or write business records. No migration is required. The fixes use the existing `main` Git-linked Vercel production release; Ready status and post-release live balances/labels are checked in the delivery report. The separately reported workflow/runtime database identity comparison remains unconfirmed; this authenticated review does not substitute for that comparison.

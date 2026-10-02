# StockFlow Development Plan

## Delivery principles

Development proceeds in narrow vertical slices. A module is not complete merely because its screens exist: schema, validation, transaction service, authorization, tests, and audit behavior must agree. Financial and inventory posting is implemented before dashboards or reports depend on it.

## Phase 0 — Architecture and foundation (complete)

Deliverables:

- Requirements baseline and unresolved business decisions
- Database design and integrity strategy
- Complete proposed Prisma schema
- Repository working rules
- Phased delivery plan

Exit criteria:

- Business reviews the unresolved decisions in `docs/requirements.md`.
- Schema decisions and ledger conventions are accepted.
- No application feature implementation has started.

## Phase 1A — Technical foundation and database initialization (complete)

This phase establishes tooling, validates the approved schema, prepares migration integrity SQL, adds shared server infrastructure, and defines idempotent foundation seeding. It explicitly excludes master-data screens and transaction posting.

### Objectives

1. Initialize Next.js, strict TypeScript, Tailwind, linting/formatting, and a minimal test runner.
2. Configure Supabase-managed PostgreSQL and Prisma with migration-based development.
3. Convert the proposed schema into the first reviewed migration, including SQL-only checks and partial indexes.
4. Add shared infrastructure: Prisma singleton, environment validation, decimal helpers, transaction wrapper, error model, and server validation conventions.
5. Prepare authentication architecture for `ADMIN`, `MANAGER`, and `STAFF`; do not create insecure placeholder sessions.
6. Seed one default location, common units, payment methods, initial expense categories, and the controlled walk-in customer.
7. Defer product, category, supplier, and customer management to Phase 1B.
8. Defer stock queries and all posting behavior to later phases.

### Tests and acceptance

- Schema migration runs on an empty database and can be recreated deterministically.
- Decimal helpers pass rounding and serialization tests.
- Prisma formatting/validation and all foundation utility tests pass.
- The idempotent seed is ready and is executed only when a development database is available.
- No purchase, sale, ledger, or payment posting is implemented yet.

### Phase 1A.2 — Supabase and Vercel cloud foundation (complete)

Supabase-hosted PostgreSQL is the primary development database; Docker/local PostgreSQL is an optional fallback. Runtime traffic uses `DATABASE_URL` through the transaction pooler, while Prisma migrations and administration use `DIRECT_URL` through a direct or session connection. The reviewed initial migration is generated from the empty schema without `db push`, incorporates all approved SQL additions, and is applied first to the isolated development project.

Phase 1A is complete only after the development Supabase database is reachable, the initial migration applies cleanly, catalog verification passes, the seed succeeds twice without duplication, and the integration suite passes. The same committed migration is later deployed to the independent production project using a controlled `prisma migrate deploy` job, never from a page request, application startup, or Preview build.

The Git deployment path is feature branch → GitHub pull request → Vercel Preview using `stockflow-dev` → review → merge to `main` → Vercel Production using `stockflow-prod`. Preview and Production credentials remain isolated.

On 2026-09-30, both development database connections succeeded, the reviewed initial migration applied cleanly, migration status reported current, all prepared catalog objects were verified, the foundation seed succeeded twice, and all ten database integration tests passed. Phase 1A is complete.

## Phase 1B — Authentication and master data (complete)

- Better Auth with Prisma-backed persistent sessions, secure cookies, disabled self-registration, active-user checks, and centralized role guards.
- Replay-safe `npm run admin:bootstrap` without seeded/default credentials.
- Responsive authenticated shell and server-rendered, paginated Category, UOM, Product, Supplier, and Customer management.
- Admin-only mutations, deactivation policy, protected system Walk-in Customer, category-cycle prevention, referenced-UOM scale protection, normalized SKUs, Decimal-safe defaults, and validated JSON specifications.
- New reviewed/applied migration `20260930020000_phase_1b_auth_master_data` plus authentication and master-data unit/integration coverage.
- UI/UX polish completed across all Phase 1B views (Inter & Plus Jakarta Sans typography, refined modern ERP palette, glass card stats, responsive sidebar, polished forms, data tables, and search/filter bars).
- Vercel production deployment verified and live at `https://stockflow-brown-mu.vercel.app` with `DATABASE_URL`, `AUTH_SECRET`, and `BETTER_AUTH_URL` configured.
- First Admin initialized via `npm run admin:bootstrap`.

### Phase 1B Performance Diagnostics & Production Optimization

- **Performance diagnostics & root causes**:
  - Baseline page TTFB: Dashboard ~3,400ms, Products ~2,000ms, Categories/Units/Suppliers/Customers ~1,370–1,530ms.
  - _Compute/DB region divergence_: Vercel functions were defaulted to `iad1` (Washington, D.C.), while Supabase PostgreSQL is in `ap-northeast-1` (Tokyo, Japan). Each network hop added ~180ms round-trip latency.
  - _Per-request auth duplication_: `ProtectedLayout` and each page independently called `getCurrentUser()`, running 4 un-cached sequential database queries (`getSession` + `prisma.user.findUnique`) per request.
  - _Sequential page queries_: Page queries (`list*`, options, auth) executed sequentially instead of concurrently. Products page also queried unused units and suppliers on list view.
  - _Serverless singleton handling_: `src/lib/db/prisma.ts` only cached client on `globalThis` in development, preventing connection pool reuse across warm production lambdas.
  - _Row action prefetching_: Table rows generated excessive concurrent serverless SSR prefetch requests.

- **Optimizations implemented**:
  - Added `vercel.json` configuring Vercel Functions compute region to Tokyo (`hnd1`), co-locating functions with the Supabase database (`ap-northeast-1`).
  - Wrapped `getCurrentUser` in React's `cache()` for request-scoped deduplication without compromising session or active-user security.
  - Parallelized independent database queries via `Promise.all` across Dashboard, Products, Categories, Units, Suppliers, and Customers.
  - Streamlined Products list page to query only active categories for filtering (`getProductFilterCategories`).
  - Cached Prisma client on `globalThis` unconditionally to reuse connections across warm serverless invocations.
  - Added `prefetch={false}` to table row action links.

- **Production UI cleanup**:
  - Replaced developer/internal roadmap text (e.g. `Phase 1B — Master Data Active`, `in V1`, `intentionally not shown yet`, `arriving in later phases`) with clean business-facing copy.
  - Implemented client `NavLinks` with active route highlighting (`bg-indigo-600/25 text-indigo-300 font-semibold border-l-2 border-indigo-400`).
  - Reduced excessive empty-state vertical spacing from `py-16` to `py-10`.

Phase 2 is implemented in the repository. Release acceptance remains pending until the reviewed migration is applied to the configured disposable development database and the complete database integration suite passes there; the implementation must not be described as release-complete before that verification.

## Phase 2 — Purchasing and supplier ledger

- Implemented draft purchase, multi-lot, and multi-line creation/editing with server-authoritative decimal totals.
- Implemented a serializable, idempotent atomic purchase posting service.
- Implemented purchase cost layers and immutable inbound stock movements.
- Implemented supplier payable entries and deterministic supplier statements.
- Implemented posted supplier payments, partial/repeated/multi-purchase allocations, and fully/partly unallocated advances.
- Implemented locked purchase-return posting against eligible cost-layer availability; returns create stock OUT movements and supplier credit without implying cash settlement.
- Implemented purchase/payment/return reconciliation and concurrency integration tests in `tests/integration/purchasing.integration.test.ts`.
- Added `20260930030000_phase_2_transaction_guardrails` for typed source semantics, posted purchase total reconciliation, supplier-allocation invariants, and return source matching.
- Added modest list, draft entry/edit, detail/post, supplier payment, purchase return, and supplier account UI.

Verification status at implementation handoff: formatter/lint, TypeScript, unit tests, Prisma validation, and production build pass. The integration suite could not reach the configured Supabase PostgreSQL host from the implementation sandbox (`EACCES` on port 5432), so migration deployment and real-database test execution remain the explicit acceptance gate.

The UI should remain operational and modest: list, detail, draft entry, review, and post. Do not build broad analytics here.

## Phase 3 — Sales, FIFO allocation, and customer ledger

### Implementation update — 2026-10-01

The project owner confirmed that Phase 2 is complete and deployed, with production migrations current. The earlier Phase 2 implementation handoff/acceptance notes above are retained as historical context and are superseded by that confirmation.

Phase 3 is implemented for review: multi-line invoice drafts/editing and decimal discounts/totals; serializable atomic FIFO posting with cost-layer locks and immutable cost snapshots; customer receivables, partial receipts, advances and later allocation; original-allocation sale returns; Sales and Customer Ledger navigation and screens. Admin/Manager mutate and Staff reads using existing session and role checks. Walk-in settlement is atomic with posting.

Added `20261001010000_phase_3_sales_guardrails`, reusing all existing Phase 3 models and adding nullable unique request keys to Payment, SaleReturn, and CustomerPaymentAllocation. The customer receipt/invoice pair now permits multiple immutable allocation events for successive partial advances. SQL checks reconcile sales/allocation movements, enforce customer ownership and allocation limits, and protect posted sales audit history. Fully discounted documents preserve zero-impact ledger entries; receipts remain strictly positive.

The approved partial-return order and cumulative credit rounding rule are recorded in `docs/requirements.md`. Tests include final-stock concurrency, duplicate posting, transactional rollback, multi-lot FIFO, partial receipts/advances, walk-in settlement, role rejection, and original-cost returns. Append-only integration fixtures remain tagged in the disposable test database; tests never disable history protection or reset a database.

Development database acceptance remains pending: this worktree has neither development connection URLs nor the disposable-target marker. No Phase 3 migration has been applied to any database. Production migration/deployment is explicitly outside this task. Apply the reviewed migration and run the Phase 3 integration file against the confirmed disposable development target before approving production deployment.

Local verification: repository lint passes, TypeScript passes after correcting the new fixture, unit tests pass (6 files / 22 tests), Prisma schema validation passes, and the production build passes using isolated build-only localhost placeholders. Changed TypeScript/Markdown files pass Prettier. Repository-wide formatting fails on 131 untouched baseline files; those files were not reformatted as part of Phase 3. Database integration execution and migration validation are blocked by missing configured development credentials, rather than claimed as passing.

Development acceptance command after confirming both URLs point to the disposable development database: `npx vitest run --config vitest.integration.config.ts tests/integration/sales.integration.test.ts`. Apply the reviewed migration using the existing controlled Prisma migration workflow first. The suite deliberately retains tagged append-only posting fixtures rather than deleting history.

- Draft invoice and line entry with approved discount rules.
- Transaction-safe FIFO allocator with row locking.
- Atomic invoice posting, lot allocations, outbound movements, and receivable entry.
- Customer receipts and allocations.
- Sale returns using original allocation costs.
- Concurrency and idempotency tests, including two simultaneous sales for the final stock.

## Phase 4 — Adjustments, expenses, and operational controls

Miscellaneous Expenses Management is implemented in code as the first authorized Phase 4 slice. It includes expense-category administration, append-only paid expense posting, audited voiding, history filters and reporting-ready totals. Development database acceptance and production deployment remain pending. Inventory quantities, stock movements, purchase lots, and FIFO costs are intentionally unaffected; landed-cost allocation remains out of scope.

- Opening inventory import/posting workflow.
- Authorized stock adjustments, damage, loss, and correction reasons.
- Expense categories and expense entry. (Implemented in code; development acceptance pending.)
- Explicit reversal workflows and role checks.
- Reconciliation/health checks surfaced to administrators.

## Phase 5 — Reports and dashboard

Only after posting workflows are stable:

- Current inventory and valuation
- Low/out-of-stock lists
- Purchase and sales histories
- Supplier/customer statements and balances
- Expense and payment reports
- Lot and product movement histories
- Basic profit analysis using sale allocation cost snapshots
- Dashboard summaries based on the same centralized queries

Every report must state date basis, status inclusion, timezone, and valuation convention.

## Phase 6 — Hardening and release

- Role/permission review
- Backup and restore rehearsal
- Production database role restrictions
- Performance profiling and evidence-based indexes
- Accessibility and responsive UI review
- Security review, rate limits where relevant, and secrets handling
- User acceptance tests using representative purchase, payment, sale, return, and correction scenarios
- Deployment/runbook and data-retention documentation

## Recommended Phase 1 work order

1. Resolve the blocking business rules: currency/tax, FIFO approval, lot number scope, fractional units, payment overages/on-account rules, opening stock valuation, and document numbering.
2. Initialize the framework and quality tooling without feature screens.
3. Implement and migrate the reference/master portion of the proposed schema first.
4. Add server validation schemas and decimal utilities.
5. Seed reference data and create the first admin safely.
6. Implement product/category/UOM services and minimal management UI.
7. Implement supplier/customer services and minimal management UI.
8. Add database integration tests and a stock-balance query ready for Phase 2.

## Definition of done for a posting feature

A later posting feature is done only when:

- Input is server-validated and authorized.
- All effects happen in one database transaction.
- Retrying is idempotent.
- Relevant rows are locked for concurrent quantity/money allocation.
- Posted records cannot be silently edited or deleted.
- Source records, stock movements, allocations, ledger entries, and payment allocations reconcile.
- Success, validation failure, insufficient stock, and concurrent conflict tests pass.
- The module's decisions and user-visible behavior are documented.

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

Phase 2 is not started. Its exact purchase draft/posting slice must be planned before implementation.

## Phase 2 — Purchasing and supplier ledger

- Draft purchase, lot, and line creation.
- Atomic purchase posting service.
- Purchase cost layers and inbound movements.
- Supplier payable entry.
- Supplier payments, allocations, and partial-payment behavior.
- Purchase returns after return-settlement rules are approved.
- Reconciliation tests for purchase totals, lot availability, and payable.

The UI should remain operational and modest: list, detail, draft entry, review, and post. Do not build broad analytics here.

## Phase 3 — Sales, FIFO allocation, and customer ledger

- Draft invoice and line entry with approved discount rules.
- Transaction-safe FIFO allocator with row locking.
- Atomic invoice posting, lot allocations, outbound movements, and receivable entry.
- Customer receipts and allocations.
- Sale returns using original allocation costs.
- Concurrency and idempotency tests, including two simultaneous sales for the final stock.

## Phase 4 — Adjustments, expenses, and operational controls

- Opening inventory import/posting workflow.
- Authorized stock adjustments, damage, loss, and correction reasons.
- Expense categories and expense entry.
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

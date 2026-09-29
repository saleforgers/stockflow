# StockFlow Repository Guide

## Purpose and current phase

StockFlow is a general-purpose inventory, purchasing, sales, payment, expense, and party-ledger system for a trading business. It must support metal products, interior products, and future categories without category-specific assumptions in core tables.

The repository status is **Phase 1B complete — ready for Phase 2 planning**. Secure database-backed authentication, the application shell, first-Admin bootstrap, and Category/UOM/Product/Supplier/Customer master-data modules are implemented. Phase 2 has not started; do not build purchasing, posting, ledger, payment, inventory-allocation, sales, expense, dashboard, or reporting workflows until explicitly authorized.

## Required stack

- Next.js with the App Router
- TypeScript in strict mode
- Supabase-managed PostgreSQL (primary); optional local PostgreSQL tooling must not block development
- Prisma ORM
- Tailwind CSS
- Reusable shadcn/ui-style components
- Server-side validation for business-critical commands

Keep dependencies small and justified. Financial and quantity calculations must not use ordinary JavaScript floating-point arithmetic.

## Architectural boundaries

When implementation begins, organize code by business capability rather than by screen:

- `src/app`: routes, layouts, server actions, and route handlers
- `src/modules/<module>`: module-specific application services, validation, queries, and types
- `src/components`: reusable presentation components only
- `src/lib`: shared infrastructure such as database, decimal, authorization, and transaction helpers
- `prisma`: schema, migrations, and deliberate seed data
- `docs`: requirements, decisions, and delivery plans

UI code must not contain posting logic, stock allocation logic, ledger rules, or financial formulas. Put those rules in server-side application services and execute multi-record posting operations in a single database transaction.

Authentication uses Better Auth with the Prisma adapter and persistent PostgreSQL sessions. Public sign-up is disabled. Every protected route and mutation must validate the session server-side; master-data mutations require `ADMIN` in Phase 1B. Never authorize from client-supplied roles or UI visibility.

Master data is deactivated rather than deleted. The controlled Walk-in Customer is immutable through normal master-data services. Category hierarchies must remain acyclic, referenced UOM decimal scales are immutable, and product specifications remain validated JSON rather than category-specific columns.

## Non-negotiable data rules

1. Stock movements are the inventory audit trail. A cached available quantity is never an independent source of truth.
2. Posted purchases, sales, returns, payments, stock movements, lot allocations, and ledger entries are append-only. Correct them through an explicit reversal/correction workflow; never silently rewrite history.
3. Supplier payable and customer receivable balances are derived from ledger entries, not editable master-data fields.
4. Every payment is its own transaction record. Multiple and partial payments must remain visible.
5. Transaction lines snapshot names, SKUs, units, prices, discounts, and costs needed to reproduce historical documents.
6. Monetary values use PostgreSQL `numeric` through Prisma `Decimal`; quantities also use fixed precision decimals.
7. Quantities and money are validated on the server. Posted inventory operations lock affected stock/lot rows and prevent negative availability by default.
8. A product has one primary inventory unit in V1. Unit conversion is out of scope until concrete conversion rules exist.
9. A distinct stocked combination is a distinct Product/SKU in V1. Product-specific characteristics are stored as validated flexible specifications, not as columns that every category must populate.
10. The current business has one location, but every inventory-bearing transaction references an inventory location so a later multi-location version is not blocked.
11. Purchase and selling defaults may change; historical line prices may not change with them.
12. Operational expenses remain separate from inventory cost in V1. Do not allocate landed cost unless a later requirement explicitly defines that behavior.
13. V1 is PKR-only and has no GST/VAT/tax calculation. User-entered transaction prices are final business prices.
14. FIFO is the V1 costing method. Posted sale allocations are immutable even when a later purchase is backdated.
15. The controlled walk-in customer may only be used for a fully paid sale.
16. Invoice-level discounts remain authoritative on the invoice header and are allocated deterministically to lines at posting for returns and profit calculations.
17. Document numbers use independent non-resetting sequences and approved prefixes. Gaps are acceptable; issued values are never reused.
18. Posted transaction history is never automatically purged. Referenced master data is deactivated instead of physically deleted.

## Posting conventions

- Draft documents may be edited and do not affect stock or ledgers.
- Posting is the atomic transition that creates all required movements, allocations, payment records, and ledger entries.
- A posted document must be idempotent: retrying the command must not create duplicates.
- Voiding a posted document must use reversal entries or a documented correction workflow. A status change alone is not a reversal.
- Human-readable numbers are unique business identifiers; internal relationships use UUID primary keys.
- Use UTC timestamps in storage and render them in the configured business timezone. Business dates remain PostgreSQL `date` values.

## Database changes

- Modify `prisma/schema.prisma` and add a reviewed migration; do not use schema push as a production migration strategy.
- Where Prisma cannot express a rule, add explicit SQL constraints in the migration and document them in `docs/database-design.md`.
- Use indexes based on actual posting and reporting access paths. Avoid speculative indexes.
- Never edit an already-applied migration.
- Runtime Prisma connections use the server-only `DATABASE_URL` transaction-pooler URL. Prisma CLI and controlled migration operations use the server/admin-only `DIRECT_URL` direct or session connection.
- Never add either database URL to a `NEXT_PUBLIC_` variable, browser bundle, log, fixture, or committed file.
- Development/Preview and Production use separate Supabase projects. Preview branches must never migrate or connect to the production database by default.
- Apply reviewed production migrations with `prisma migrate deploy` through a controlled deployment job, never during a page request, application startup, or Vercel Preview build.
- Never run `prisma migrate reset` against a shared, non-disposable, or production database.

## Quality checks for later phases

Each module should include focused tests for its invariants. At minimum, posting tests must cover atomicity, idempotency, concurrent stock consumption, decimal rounding, partial payments, returns, reversals, and rejection of negative stock.

Before handing off a change, run the relevant formatter, linter, type check, tests, and Prisma validation when those tools exist in the repository. Do not hide failing checks.

## Decision discipline

Record assumptions before implementing them. If a missing rule could alter stock, cost of goods sold, supplier payable, customer receivable, payments, tax, discounts, or historical records, stop and obtain a business decision rather than guessing. The unresolved Phase 0 decisions are maintained in `docs/requirements.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

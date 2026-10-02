# Business modules

Each business capability will live in its own directory under `src/modules/<module>` with its server-side validation, application services, queries, and domain types.

Phase 1B implements authentication and the Category, UOM, Product, Supplier, and Customer master-data modules. Each mutation authenticates, authorizes, validates, normalizes, writes through Prisma, translates expected errors, and revalidates its route.

Phase 2 implements purchasing, supplier payments/ledger, inbound cost layers and movements, and purchase returns in `purchases`. Phase 3 implements sales drafts, FIFO posting, customer receipts/ledger and advance allocations, and original-cost sale returns in `sales`. Server Actions reauthenticate and authorize each command; application services own all financial/inventory calculations and atomic posting. Phase 3 development database acceptance is pending. Expenses, stock adjustments, analytical dashboards, and reporting remain deferred.

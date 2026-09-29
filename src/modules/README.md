# Business modules

Each business capability will live in its own directory under `src/modules/<module>` with its server-side validation, application services, queries, and domain types.

Phase 1B implements authentication and the Category, UOM, Product, Supplier, and Customer master-data modules. Each mutation authenticates, authorizes, validates, normalizes, writes through Prisma, translates expected errors, and revalidates its route.

Purchase, sale, ledger, payment, expense, inventory-posting, analytical dashboard, and reporting modules remain unimplemented until their later authorized phases.

# Expense and invoice redesign

Approved scope: expense entry/detail and sale/purchase entry, draft edit and detail pages. Use the existing StockFlow palette with compact invoice headers, responsive editable rows, expandable notes and prominent totals. Expense remains a single paid operating expense, not a journal voucher.

Preserve payment controls, balances, ledger/item-history links, settlement history, receiving lots, server action payloads and all posting rules. Estimates, lists, returns and PDF output are excluded. No schema or migration changes.

Review the three screen designs in a local preview before production release. Use synthetic browser data for presentation review; do not run transaction fixtures against the unconfirmed shared database target. Complete formatting, lint, typecheck, unit tests, Prisma validation and build before handoff.

## Implementation and verification — 2026-10-08

- Shared document headings, grid headings and totals now support the three workflows. Desktop invoice rows become labelled stacked fields on mobile; product dropdowns remain outside clipping containers.
- Purchase detail headings now match purchase price, discount, net unit cost, amount and available quantity. Existing settlement sections and action permissions remain intact.
- Entry forms prevent the automatic React form reset on a returned validation failure. This preserves expense fields and keeps invoice payment selections consistent with their retained amounts; successful actions still redirect normally.
- `npm run check` passed: formatting, lint, typecheck, 53 unit tests across 19 files, and Prisma validation. Production build passed. Windows sandbox cache/path restrictions were resolved using a workspace test cache and an external local build.
- Browser review used the actual form components with synthetic data and local stub actions: keyboard product selection, add/remove lines and receiving lots, draft error retention, partial payment, walk-in full payment, estimates retaining their original layout, and entry/detail views at desktop and mobile widths. Detail rendering used mocked queries; no business records were written.
- Local review: `http://127.0.0.1:4320/`. Screenshots are in ignored `output/invoice-redesign/`; review tooling is in ignored `tmp/invoice-review/`. The owner accepted the design and authorized production release on October 8. The broader regression review and release boundaries are recorded in `docs/product-release-audit-2026-10-08.md`.

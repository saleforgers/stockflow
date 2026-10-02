# StockFlow V1 Database Design

## Phase 3 implementation supplement — 2026-10-01

Migration `20261001010000_phase_3_sales_guardrails` adds nullable unique UUID `requestKey` columns to the existing Payment, SaleReturn, and CustomerPaymentAllocation models. Legacy and supplier rows remain null. The customer receipt/invoice pair uniqueness becomes a nonunique lookup index so successive partial advance allocations can be appended. Invoice posting uses the invoice UUID/status as its replay identity; immediate receipt keys use that UUID. Receipts, advance allocation commands, and returns serialize request-key retries with a transaction advisory lock, and durable unique indexes prevent duplicate effects.

Sales transactions use serializable isolation with bounded retries only for rollback-confirmed serialization/deadlock conflicts. Posting locks the invoice, then inventory rows by product and lot ID; allocation reads locked available layers by `receivedAt`, then lot ID. All line allocations, outbound movements, cost-layer quantities, receivables, posting status, and any immediate receipt commit together. Allocation snapshots never change after posting. Later backdated purchases do not reallocate sales.

Customer receipt allocation locks invoices in sorted ID order; existing advance allocation locks invoice then receipt. Amounts cannot exceed receipt availability or invoice outstanding after posted returns/allocations. A receipt produces one ledger credit for its full amount regardless of allocations; allocating an advance creates no second ledger credit. Cached payment status includes return credits and is never the party-balance source. Posted allocations are append-only events; subsequent portions of the same advance can be allocated to the same invoice with new request keys.

Sale returns lock the original invoice and affected layers, restore unreturned original allocations in approved FIFO order, retain unit-cost snapshots, and calculate cumulative proportional credit after both discounts. SQL constraints/triggers verify quantity/cost/source/movement agreement and posted totals, enforce customer allocation ownership/limits and walk-in full settlement, and reject updates/deletes to posted sales facts. Settlement cache updates remain permitted. Fully discounted invoices and zero-credit returns retain zero-impact SALE/SALE_RETURN ledger events; all payments and other ledger entries remain positive. Returns can leave customer credit balances; no automatic cash refund occurs.

No new tables, browser database access, Data API grants, or security-definer functions are introduced. Trigger functions use invoker privileges and revoke PUBLIC execution. Existing Phase 1/2 SQL and runtime services remain intact. Development migration/integration acceptance is required before production deployment.

## 1. Design goals

The model prioritizes traceability, correct concurrent posting, historical accuracy, and a practical V1 scope. Supabase-managed PostgreSQL is the authoritative data store and Prisma is the only application ORM/database access path. The executable schema is in `prisma/schema.prisma`; SQL-only constraints in `prisma/sql/initial-integrity-constraints.sql` are incorporated into the reviewed initial migration. The supplement is not an independently applied migration.

The Next.js runtime uses `DATABASE_URL` through the Supabase transaction pooler. Prisma CLI, migrations, seeding, and database administration use `DIRECT_URL` through a direct or session connection. Both are server-only. Development/Preview and Production databases are separate projects and share migrations through Git, not data.

## 2. Core decisions

### 2.1 Product and specification strategy

In V1, a `Product` is the stocked/sellable SKU. If two otherwise similar sheets have different gauge, size, quality, or another characteristic that affects stocking or sale, each is a separate Product with its own SKU.

Product-specific data lives in the PostgreSQL JSONB `specifications` field, for example:

```json
{
  "material": "Mild steel",
  "gauge": "18",
  "size": { "length": 8, "width": 4, "unit": "ft" },
  "grade": "A"
}
```

The application validates this object as scalar values or small structured values with stable, normalized keys. Frequently filtered attributes may later be promoted to dedicated indexed columns or normalized definitions without changing the transaction model.

This approach avoids dozens of nullable category-specific columns and avoids a premature entity-attribute-value system. Its tradeoff is weaker database-level type enforcement and less convenient attribute filtering. Product variants are represented as sibling SKU records in V1; a separate product-family/variant model can be introduced after actual catalogue workflows justify it.

### 2.2 Units of measurement

`UnitOfMeasure` is managed reference data. Each product has exactly one inventory unit. Transaction lines snapshot the unit code so historical documents remain readable after master-data changes. `decimalScale` controls input validation: zero for indivisible pieces/sheets and an approved positive scale for kg, feet, meters, and similar units.

Conversions and secondary selling units are out of scope. They should not be approximated with hidden multipliers.

### 2.3 Locations

`InventoryLocation` is present from the start even though V1 seeds one default location. Inventory lots, stock movements, purchases, invoices, and returns carry a location. This small addition prevents a costly inventory-table redesign if multiple locations are added later. V1 services reject cross-location activity and choose the single active default automatically unless the UI later exposes it.

V1 seeds `MAIN / Main Inventory` as the only active default and does not expose location selection in normal screens.

### 2.4 Decimal types

- Currency totals and payments: `Decimal(18,2)`
- Unit prices and unit costs: `Decimal(18,4)`
- Quantities: `Decimal(18,4)`

Use Prisma `Decimal` or a decimal library at service boundaries. Convert values to strings for transport where necessary; never coerce money through JavaScript `number` during calculation.

### 2.5 Document numbers and retention

Each document type owns an independent PostgreSQL sequence and prefix: `PUR`, `INV`, `PAY`, `PRT`, `SRT`, `EXP`, `ADJ`, and `LOT`. Services later obtain `nextval` inside the creation transaction and format at least six digits. Sequences never reset, sequence gaps are valid, and issued numbers are never reused. Unique fields plus migration CHECK constraints enforce type-specific formats.

Posted transactional history is retained indefinitely by application behavior in V1. Reversal creates new history rather than deleting the original. Referenced master records are deactivated. This is an application retention policy, not a claim about statutory retention or production backup duration.

## 3. Entity map

| Area        | Entities                                                                                                        | Purpose                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Identity    | `User`, `Account`, `Session`, `Verification`                                                                    | Authentication identity, credentials, persistent sessions        |
| Catalogue   | `Category`, `UnitOfMeasure`, `Product`                                                                          | Product master data and flexible specifications                  |
| Parties     | `Supplier`, `Customer`                                                                                          | Counterparty master data; balances are not stored here           |
| Inventory   | `InventoryLocation`, `InventoryLot`, `StockMovement`, `StockAdjustment`, `StockAdjustmentLine`                  | Location-aware quantity audit trail and FIFO cost layers         |
| Purchasing  | `Purchase`, `PurchaseLot`, `PurchaseLine`, `PurchaseReturn`, `PurchaseReturnLine`                               | Supplier documents, lots, actual historical costs, and returns   |
| Sales       | `SalesInvoice`, `SalesInvoiceLine`, `SaleLotAllocation`, `SaleReturn`, `SaleReturnLine`, `SaleReturnAllocation` | Historical prices, FIFO consumption, cost snapshots, and returns |
| Cash events | `PaymentMethod`, `Payment`, `SupplierPaymentAllocation`, `CustomerPaymentAllocation`                            | Individual payments and document allocations                     |
| Subledgers  | `SupplierLedgerEntry`, `CustomerLedgerEntry`                                                                    | Reconstructable payable and receivable histories                 |
| Expenses    | `ExpenseCategory`, `Expense`                                                                                    | Operational spending, separate from inventory costing            |

## 4. Important relationships

- Category 1—N Product; categories may form a shallow parent/child hierarchy.
- UnitOfMeasure 1—N Product.
- Supplier 1—N Purchase and optionally 1—N preferred Product.
- Purchase 1—N PurchaseLot; PurchaseLot 1—N PurchaseLine.
- PurchaseLine 1—0..1 InventoryLot in V1. Posting creates the lot/cost layer.
- Product/Location 1—N InventoryLot and StockMovement.
- SalesInvoice 1—N SalesInvoiceLine.
- SalesInvoiceLine N—M InventoryLot through SaleLotAllocation.
- Each SaleLotAllocation has one outbound StockMovement.
- SaleReturnLine references the original SalesInvoiceLine and returns through one or more SaleReturnAllocation records tied to original sale allocations.
- Payment N—M Purchase through SupplierPaymentAllocation, or N—M SalesInvoice through CustomerPaymentAllocation. Database checks enforce one counterparty kind per payment.
- Each posted commercial document/payment creates the corresponding supplier or customer ledger entry.
- Expense optionally references Supplier and PurchaseLot for context only; it does not alter inventory lot cost.

## 5. Document lifecycle and immutability

Commercial headers use `DRAFT`, `POSTED`, and `VOID`. Drafts create no stock or ledger effect. Posting sets `postedAt` and atomically creates all effects. `VOID` is not itself an accounting operation: a posted document reaches that state only after reversal records have been created.

Service rules reject edits to financially or physically meaningful fields after posting. Database roles should deny hard deletion of posted data in production. Master records use `isActive` rather than deletion when referenced.

### 5.1 Authentication persistence

Better Auth owns `Account`, `Session`, and `Verification`. Credential passwords are memory-hard hashes in `Account.password`; the removed Phase 1A proposal field `User.passwordHash` is not duplicated. `User` adds `emailVerified` and optional `image` for adapter compatibility while retaining the StockFlow `UserRole` enum and `isActive` control. Session/account rows cascade only when a User is deliberately removed; business transaction relations still restrict deletion of historically referenced users.

`Session.token` is unique, sessions have indexed expiry/user fields, and credential accounts are unique by `(providerId, accountId)`. Application guards re-check `User.isActive` on every protected request. The first Admin service uses an advisory lock and a serializable transaction so bootstrap cannot race or silently create a second Admin.

### 5.2 Phase 1B master-data invariants

- Category slugs and Product SKUs are normalized before unique writes.
- Category parent changes traverse ancestors and reject self-links/cycles.
- UOM decimal scale stays within 0–4 and cannot change once a Product references the unit.
- Product default prices and thresholds are parsed as decimal strings; ordinary JavaScript floating point is not used.
- Product specification rows become a normalized JSON object with unique stable keys and nonempty values.
- Master data is deactivated, not hard-deleted. The seeded Walk-in Customer cannot be edited or deactivated through normal services, and the partial unique database index still prevents a second one.

## 6. Purchase lots and inventory cost layers

`PurchaseLot` is the business grouping and lot number; it can contain different products. `PurchaseLine` stores each product's quantity, unit cost, snapshots, and line total. On posting:

1. Validate the purchase totals and status.
2. Create one `InventoryLot` per line with origin `PURCHASE`, original and available quantity equal to the line quantity, and an immutable unit-cost snapshot.
3. Create one `PURCHASE`/`IN` stock movement for the same product, location, lot, and quantity.
4. Create a supplier-ledger `PURCHASE`/`INCREASE` entry for the purchase total.
5. Post any recorded supplier payment separately and create its ledger decrease.

The human lot stays available even when `availableQuantity` reaches zero. `InventoryLot.availableQuantity` is a transactionally maintained allocation cache. It supports safe row locking and efficient FIFO selection; it is not the only evidence of stock. It must reconcile to original quantity plus/minus posted lot-level movements.

Opening stock and authorized positive adjustments may create system cost layers with origins `OPENING` or `ADJUSTMENT`, a documented unit cost, and no purchase line.

An opening balance is represented by a posted `StockAdjustment`/`StockAdjustmentLine` with movement type `OPENING_STOCK`. Its `StockMovement.adjustmentLineId` is therefore the required single movement source. Posting also creates the positive `InventoryLot` with origin `OPENING`, so the source constraint is not weakened for opening inventory.

Internal `PurchaseLot.lotNumber` is globally unique and generated in `LOT-000001` form. The initial migration creates a PostgreSQL sequence; the later purchase service obtains its next value inside the draft-creation transaction and formats it with the `LOT-` prefix and at least six digits. Sequence gaps are acceptable and numbers are never reused. `supplierLotReference` is optional, non-unique supplier-provided context. One supplier commercial bill is one Purchase and can contain multiple Purchase Lots. Opening layers require a positive, explicitly approved unit cost; zero/unknown-cost opening stock is invalid.

## 7. FIFO sale allocation

Within the sale's location, posting selects cost layers for a product where `availableQuantity > 0`, ordered by `receivedAt`, then `id`. The transaction locks candidate rows (`SELECT ... FOR UPDATE` or an equivalent safe approach), verifies total availability, and consumes layers until the requested quantity is satisfied.

For every consumed portion it creates:

- `SaleLotAllocation(quantity, unitCostSnapshot)` linking sale line to cost layer;
- one `SALE`/`OUT` stock movement linked to that allocation; and
- an atomic decrement of the layer's available quantity guarded so it cannot fall below zero.

The cost snapshot makes historical cost of goods sold `SUM(allocation.quantity × allocation.unitCostSnapshot)` even if master data or later corrections change. Allocation rows are immutable.

Backdated purchases participate in FIFO only for sales posted after that purchase exists. They never cause an already-posted sale's allocation rows to be recalculated.

### Returns

A sale return references original invoice lines. Returned quantity is distributed back to the original sale allocations (normally reverse allocation order unless the operator identifies exact goods), producing `SALE_RETURN`/`IN` movements and increments to those original layers. Aggregate returned quantity may not exceed the original allocation quantity.

A purchase return references the original cost layer, produces `PURCHASE_RETURN`/`OUT`, and decrements available quantity. V1 rejects a return quantity greater than currently available in that layer. Financial settlement of returns is recorded in the relevant ledger; cash settlement, if any, is a separate payment/refund event after the business rule is approved.

## 8. Stock movements and current stock

`StockMovement.quantity` is always positive. `direction` determines its sign:

```text
current stock = SUM(IN quantities) - SUM(OUT quantities)
```

Each movement has a product, location, effective timestamp, type, actor, optional cost layer, and a typed source link. SQL constraints ensure a movement is attached to the correct source for its type. Source-specific unique constraints prevent posting the same allocation/line twice.

V1 does not store `Product.currentStock`. Current stock is queried from movements and can later be materialized/cached only with reconciliation tooling. `InventoryLot.availableQuantity` is the deliberate exception used for concurrent allocation control.

Stock adjustments use a header plus lines and require a reason. Damage, loss, and correction are distinct movement types. Negative availability is forbidden.

## 9. Supplier ledger

Ledger terminology is intentionally business-facing:

- `INCREASE`: business owes the supplier more.
- `DECREASE`: business owes the supplier less.

| Event                   | Entry type          | Effect   |
| ----------------------- | ------------------- | -------- |
| Posted purchase         | PURCHASE            | INCREASE |
| Supplier payment        | PAYMENT             | DECREASE |
| Purchase return         | PURCHASE_RETURN     | DECREASE |
| Payable correction up   | ADJUSTMENT_INCREASE | INCREASE |
| Payable correction down | ADJUSTMENT_DECREASE | DECREASE |

All amounts are positive. Payable is `SUM(INCREASE) - SUM(DECREASE)`. No editable supplier balance is stored. Each entry has a typed foreign key to its source where applicable, and source uniqueness makes posting idempotent. Statements use deterministic ordering by `entryDate`, `createdAt`, then `id` and calculate running balances at query/report time.

## 10. Customer ledger

- `INCREASE`: customer owes the business more.
- `DECREASE`: customer owes the business less.

| Event                      | Entry type          | Effect   |
| -------------------------- | ------------------- | -------- |
| Posted sales invoice       | SALE                | INCREASE |
| Customer receipt           | PAYMENT             | DECREASE |
| Sale return                | SALE_RETURN         | DECREASE |
| Receivable correction up   | ADJUSTMENT_INCREASE | INCREASE |
| Receivable correction down | ADJUSTMENT_DECREASE | DECREASE |

Receivable is `SUM(INCREASE) - SUM(DECREASE)`. No editable customer balance is stored. Adjustments require a reason and authorization in the application service.

## 11. Payments and partial allocation

`Payment` represents one movement of money with a stable kind: customer receipt/refund or supplier payment/refund. It has exactly one customer or supplier, one payment method, and a positive amount. Allocation rows apply all or part of the payment to documents.

Document paid amount is the sum of posted allocations, adjusted by reversals. Remaining balance and payment status are derived. The header's `paymentStatus` is a transactionally maintained display cache on invoices/purchases and must reconcile to allocations plus ledger credits.

Allocation sums may never exceed the payment. V1 explicitly permits partially allocated and fully unallocated payments, advances, overpayments, customer credit balances, and supplier advance balances. The unallocated amount is derived as payment amount minus posted allocations and stays visible on the party account. Allocation changes after posting require an auditable reallocation/reversal workflow rather than deletion.

## 12. Discounts and historical pricing

Sale lines store actual `unitPrice`, `grossAmount`, `lineDiscountAmount`, `netAmount`, and the allocation snapshot `invoiceDiscountAllocated`. The invoice stores the one authoritative `invoiceDiscountAmount`; the line value is only its allocated share. Purchase lines store actual unit cost and line total. Product default prices are never joined to reconstruct a historical document.

At posting, calculate exact proportional header-discount shares from each line's net amount, truncate to currency precision, then distribute remainder cents by descending fractional remainder and ascending immutable line ID. The allocated values must sum exactly to the header discount. Names, SKU, and UOM code are snapshotted on transaction lines. Posted invoice headers snapshot customer name/phone/address; posted purchase headers snapshot supplier name/phone/address.

The effective line revenue used for returns and profit is `netAmount - invoiceDiscountAllocated`.

## 13. Expenses

Expense categories and payment methods are reference tables. V1 Expense rows represent paid expenses. They may point to a supplier or purchase lot for context, but this reference does not create a supplier ledger entry and does not change a cost layer. Unpaid/accrued expenses are out of scope.

## 14. Required database constraints

The Prisma schema expresses basic keys, uniqueness, types, and indexes. The initial SQL migration must additionally implement:

1. Positive checks on all quantities, unit prices/costs, payment amounts, ledger amounts, and expense amounts.
2. Nonnegative checks on discounts/additional charges and `availableQuantity`.
3. `availableQuantity <= originalQuantity`; positive corrections create a new adjustment layer rather than expanding an existing layer.
4. Sale line: `grossAmount = round(quantity * unitPrice, 2)`, `0 <= lineDiscountAmount <= grossAmount`, and `netAmount = grossAmount - lineDiscountAmount` (or enforce in service plus deferred validation if PostgreSQL rounding semantics differ).
5. Invoice: header discount cannot exceed subtotal; final total cannot be negative.
6. Purchase totals and return totals must equal their line sums under the agreed rounding policy.
7. A Payment has exactly one of `supplierId` or `customerId`, and its kind matches that party type.
8. Supplier allocations are allowed only for supplier payment kinds and purchases for that same supplier; customer allocations follow the analogous rule. Cross-row party rules require transaction code or deferred constraint triggers.
9. A stock movement has the source relation required by its movement type and no conflicting source relation.
10. A purchase-origin lot has a purchase line; opening/adjustment lots do not.
11. Source-specific ledger types/effects match the referenced document.
12. Posted document numbers are immutable and unique.
13. Only one active default inventory location (partial unique index).
14. Only one controlled walk-in customer (partial unique index); services additionally require its posted invoices to be fully paid.
15. Aggregate sale returns cannot exceed sold line/allocation quantities; aggregate purchase returns cannot exceed eligible quantities. Enforce within locked posting transactions.
16. Payment allocation totals cannot exceed payment amount. Enforce within locked posting transactions.
17. A purchase line's `purchaseId` must equal its purchase lot's `purchaseId`.
18. Purchase-return supplier/location/product references must match their original purchase, line, and lot; sale-return location/product references must match the original invoice, line, and allocation.
19. Ledger party and currency must match the referenced source document or payment.
20. Category parentage must not contain self-links or cycles; enforce cycle detection in the category service.
21. All transaction currency codes must be `PKR` in V1.
22. Unit decimal scale must be between 0 and 4; command validation rejects quantities with more fractional digits than the product UOM permits.
23. Each line's allocated header discount must be nonnegative and no greater than its net amount. For a posted invoice, line allocations must sum exactly to the authoritative header discount; enforce through the posting transaction and a deferred database trigger.
24. Human-readable document numbers must match their document prefix and contain at least six digits. Independent database sequences provide transaction-safe, never-reused source values; gaps are accepted.

Cross-row aggregate invariants cannot be reliably handled by ordinary CHECK constraints. They belong in transaction services with row locking, backed by unique constraints and targeted triggers only where concurrent writers could bypass the service.

## 15. Index strategy

Key proposed indexes include:

- Product: unique SKU; category/isActive; preferred supplier; GIN on `specifications` only when attribute search is implemented.
- Purchase: unique purchase number; supplier/date; status/date.
- Purchase lot: globally unique internal lot number; purchase; optional supplier lot reference.
- Inventory lot: product/location/available quantity/received time for FIFO; purchase lot; purchase line unique.
- Stock movement: product/location/effective time; inventory lot/effective time; movement type/effective time; typed source unique indexes.
- Invoice: unique invoice number; customer/date; status/date.
- Sale allocation: sale line; inventory lot.
- Payments: unique payment number; supplier/date; customer/date; status/date.
- Ledger: party/effective date/id; each source foreign key unique where one source creates one entry.
- Expenses: date/category; supplier/date; purchase lot.

Avoid indexing every foreign key blindly; retain indexes that serve posting, reconciliation, statements, or planned reports.

## 16. Integrity and operational risks

| Risk                                    | Consequence                           | Mitigation                                                          |
| --------------------------------------- | ------------------------------------- | ------------------------------------------------------------------- |
| Concurrent sales consume the same layer | Negative/incorrect stock              | Lock FIFO lot rows; guarded update; atomic posting                  |
| Retried posting request                 | Duplicate movements/ledgers           | Status transition plus unique source keys and idempotency checks    |
| Editing posted documents                | History changes silently              | Service immutability, restricted DB role, reversals                 |
| JavaScript floating point               | Incorrect totals                      | Prisma Decimal and centralized rounding                             |
| Backdated transaction                   | Chronology differs from entry time    | Role-gate backdating; never recalculate existing FIFO allocations   |
| JSON specification drift                | Unreliable search/data                | Normalized keys and server schemas; promote proven fields later     |
| Cached lot availability diverges        | Incorrect allocation                  | Same-transaction updates and reconciliation query/tests             |
| Payment allocation mismatch             | Wrong status/balance                  | Locks, sum constraints in service, ledger reconciliation            |
| Header discount on partial returns      | Incorrect refund/margin               | Immutable proportional line allocation with deterministic remainder |
| Hard deletion of referenced masters     | Broken audit trail                    | Foreign keys plus deactivate instead of delete                      |
| Manual database edits bypass services   | Unbalanced history                    | Least-privilege production role, monitoring, reconciliation         |
| Walk-in sale posted with balance        | Shared receivable becomes meaningless | Require full payment in the posting transaction                     |

## 17. Reconciliation queries required before release

Implementation must include automated checks that compare:

- Product/location movement balance against sum of open lot availability.
- Each lot's cached availability against its lot-level movement/allocation history.
- Invoice payment cache/status against posted customer allocations and credits.
- Purchase payment cache/status against posted supplier allocations and credits.
- Supplier balance against supplier ledger entries.
- Customer balance against customer ledger entries.
- Posted document totals against line totals.

Any discrepancy is an error to investigate, not a value to silently overwrite.

## 18. Phase 2 implementation

Phase 2 uses the schema designed above without adding parallel balance or stock fields. Draft purchase services issue independent `PUR` and `LOT` numbers from the existing PostgreSQL sequences, validate active supplier/product/UOM references, calculate every line with decimal arithmetic, and persist authoritative subtotal/additional-charge/total values. Draft replacement is permitted only while the header remains `DRAFT`.

Purchase posting locks the header and runs at serializable isolation. One transaction refreshes historical party/product/UOM snapshots, creates one purchase-origin `InventoryLot` and one `PURCHASE`/`IN` movement per line, creates the `PURCHASE`/`INCREASE` supplier-ledger entry, and transitions the header to `POSTED`. Source uniqueness makes a completed posting replay-safe; drafts have no inventory or ledger effect.

Supplier payments are separate posted `Payment` records. Their full amount creates one `PAYMENT`/`DECREASE` ledger entry, while allocation rows explain settlement against posted purchases. Allocations may cover multiple purchases and may consume only part of a payment; the remainder is an on-account supplier advance. Locked target purchases and serializable execution protect allocation limits and update `Purchase.amountPaidCached` / `paymentStatus` from posted allocations plus posted purchase-return credit.

Purchase returns lock their original cost-layer rows, reject quantities above current availability, decrease the availability cache, and create immutable `PURCHASE_RETURN`/`OUT` movements plus `PURCHASE_RETURN`/`DECREASE` supplier-ledger entries. They do not rewrite the original purchase and do not represent a cash refund.

Migration `20260930030000_phase_2_transaction_guardrails` adds database checks for Phase 2 typed source semantics and deferred cross-row triggers for supplier allocation limits/party ownership, posted purchase total reconciliation, and purchase-return source matching. Application services remain responsible for authorization, active-reference validation, deterministic locking, and aggregate return eligibility.

Phase 2 integration coverage is in `tests/integration/purchasing.integration.test.ts`, including drafts, fractional UOM rules, atomic/idempotent posting, reconciliation, full/partial/repeated/multi-document/unallocated payments, returns, authorization, rollback behavior, and concurrent return attempts. The migration and suite must pass on the disposable development database before Phase 2 is marked release-complete.

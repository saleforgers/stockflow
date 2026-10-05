# StockFlow V1 Requirements Baseline

## Transaction-screen enhancement supplement — 2026-10-06

Sales forms surface the selected customer's phone, derived account balance, ledger shortcut, current product stock, line amount, and item-history shortcut. Historical customer balance remains separate from the current invoice total and invoice balance. Posting presents explicit Paid, Credit, and Partial Payment choices while continuing to use posted customer receipts and allocations.

Purchase forms surface the selected supplier's phone, derived payable, ledger shortcut, current product stock, current default selling price, and item-history shortcut. Purchase lines accept a fixed PKR discount. The entered gross purchase price and discount are retained, while the derived net unit cost is the authoritative FIFO cost. Paid, Credit, and Partial Payment choices reuse supplier payments and allocations; a payment selected during posting commits atomically with the purchase.

Customer and supplier ledgers use Date, Reference, Description/Narration, Debit, Credit, and Running Balance presentation with party-specific summary totals and downloadable statements. Product history is reconstructed from existing stock movements; unit cost is restricted to Admin and Manager. This enhancement does not add percentage discounts, a general ledger, journal vouchers, chart of accounts, multi-store workflows, currency rates, project accounting, or legacy desktop styling.

## 1. Scope

StockFlow V1 is a web-based inventory and commercial-record system for a general trading business. It must support heterogeneous products without embedding assumptions about iron, sheets, furniture, interior goods, or any other single category.

Phase 0 produced the approved architecture and data model. Phase 1A established the validated technical/cloud foundation, and Phase 1B added secure authentication plus master-data management. Phase 2 implements purchase drafts, atomic purchase posting, inbound inventory cost layers/movements, supplier payable, supplier payments/allocations, supplier account visibility, and purchase returns. Sales, customer-ledger, FIFO sale allocation, expenses, dashboards, and reporting remain deferred to explicitly authorized later phases. StockFlow uses GitHub, Vercel, and Supabase-managed PostgreSQL; Supabase is a database provider only, and all business access remains server-side through Prisma.

Development/Preview and Production use independent Supabase projects and credentials. Preview deployments must use the development project by default. Database URLs are server secrets and must never be exposed as `NEXT_PUBLIC_` variables. Docker/local PostgreSQL is optional developer tooling, not a prerequisite.

## 2. Actors

- **Admin:** system setup, master data, all transactions, and user administration.
- **Manager:** operational transactions and oversight; exact restrictions remain to be decided.
- **Staff:** limited day-to-day entry; exact restrictions remain to be decided.
- **Walk-in customer:** represented by a controlled customer record so every invoice has a party and ledger path.

V1 authorization will use a simple role on the user record. Fine-grained permissions are not required yet.

Phase 1B locks master-data mutations to Admin. Manager and Staff roles remain valid and can view authenticated master data, but broader mutation permissions are not inferred. Self-registration is disabled; the first Admin is created by a replay-safe CLI bootstrap.

Phase 2 operational mutations are available to active Admin and Manager users. Staff remains read-only for Phase 2 because no broader Staff transaction policy has been approved. Every Phase 2 Server Action repeats authorization and validation server-side.

## 3. Functional requirements

### 3.1 Product catalogue

- Maintain categories, units of measurement, suppliers, and products.
- Each sellable/stocked combination has a unique SKU and one primary inventory unit.
- A product may hold flexible specifications such as gauge, size, quality, material, color, dimensions, brand, finish, or future attributes.
- A product may have an optional preferred supplier, but actual supplier history comes from purchases and may include many suppliers.
- Default purchase and selling prices are conveniences only; transaction lines preserve actual prices.
- Low-stock status is derived from current available stock and the product threshold.

### 3.2 Purchasing and purchase lots

- A purchase belongs to one supplier and receiving location and may contain one or more named purchase lots.
- A lot may contain multiple product lines with independent quantities and unit costs.
- Posting a purchase creates an inventory cost layer for each purchase line, purchase stock movements, and a supplier-ledger increase.
- Payments at purchase time and later payments are separate payment records and can be allocated to one or more purchases.
- Purchase history and cost layers remain available after stock is sold.

### 3.3 Inventory

- Every stock change is represented by an immutable stock movement with product, location, direction, type, quantity, date, actor, and source.
- Supported movement reasons include opening stock, purchase, sale, sale return, purchase return, adjustment, damage, loss, and correction.
- Current stock is the sum of signed posted movements. V1 may cache per-lot available quantity for safe allocation, but the movement and allocation records remain the audit trail.
- Negative product stock and negative lot availability are rejected by default.
- V1 sales allocate stock using FIFO by receipt time, then lot ID as a deterministic tie-breaker.

### 3.4 Sales and invoicing

- An invoice belongs to a customer, including a controlled walk-in customer where appropriate.
- Invoice lines snapshot product identity, unit, quantity, actual price, line discount, and net line amount.
- V1 supports both line discounts and one invoice-level discount amount. The invoice discount is applied after summing net lines and is stored once on the header.
- At posting, the header discount is proportionally allocated across lines and snapshotted in `SalesInvoiceLine.invoiceDiscountAllocated`; this is an allocation of the authoritative header value, not a second discount.
- Posting an invoice atomically creates FIFO lot allocations, outbound stock movements, and a customer-ledger increase.
- Receipts at sale time and later receipts are separate payment records and may be allocated to invoices.
- Unpaid, partially paid, and paid status is derived from posted receipts/credits and may be cached transactionally for display.

### 3.5 Returns and corrections

- A sale return references the original invoice lines and restores quantities to the original cost layers whenever the original allocation is known.
- A purchase return references the original purchase line/cost layer and may not return more than the unsold quantity available in that layer unless a separate, authorized business process is defined.
- Posted records are not edited or deleted. Corrections use explicit returns, reversal entries, or correction movements with a reason and actor.

### 3.6 Supplier accounts

- Supplier payable is reconstructed from immutable supplier-ledger entries.
- The application uses unambiguous effects: `INCREASE` raises the amount owed to a supplier; `DECREASE` lowers it.
- Posted purchases increase payable. Supplier payments and purchase returns decrease payable. Authorized adjustments explicitly state their effect.
- A supplier statement is ordered deterministically by effective date, creation time, and entry ID.

### 3.7 Customer accounts

- Customer receivable is reconstructed from immutable customer-ledger entries.
- `INCREASE` raises the amount the customer owes; `DECREASE` lowers it.
- Posted invoices increase receivable. Customer receipts and sale returns decrease receivable. Authorized adjustments explicitly state their effect.
- A customer statement is ordered deterministically by effective date, creation time, and entry ID.

### 3.8 Payments

- Each payment/receipt has its own number, counterparty, amount, date, method, reference, notes, actor, and timestamps.
- Payments can be partial, repeated, and allocated across documents.
- A payment may be partly or fully unallocated. Customer advances, supplier advances, overpayments, customer credit balances, and supplier advance balances remain associated with the party and visible in payment and ledger history.
- Payment methods are managed records seeded with Cash, Bank Transfer, Cheque, and Other so additional methods do not require a schema change.
- Voiding a posted payment must create or trigger an auditable reversal; it must not erase the original ledger event.

### 3.9 Expenses

- Expense categories are manageable rather than hard-coded.
- An expense records amount, business date, description, payment method, optional supplier, optional purchase lot, reference, notes, actor, and timestamps.
- Operational expenses do not modify inventory value in V1, including freight associated with a lot.

### 3.10 Audit and history

- Business transactions record the responsible user.
- Drafts can change; posted business facts are immutable except through explicit corrective events.
- Historical documents use snapshots and are unaffected by later changes to product names, SKUs, units, default prices, customer names, or supplier names where legally/business-relevant display must be preserved.

## 4. Calculations and conventions

- Money: PostgreSQL `numeric(18,2)` for totals and payments; unit prices/costs use `numeric(18,4)` to avoid premature rounding.
- Quantities: `numeric(18,4)`; a unit's `decimalScale` defines whether fractional quantities are accepted.
- A line gross amount is `quantity × unit price`, rounded to currency precision.
- A sale line net amount is gross amount minus its line discount.
- Invoice subtotal is the sum of line net amounts. Final total is subtotal minus the single header discount amount. V1 has no GST/VAT/tax calculation; entered prices are final transaction prices.
- Header discount allocation uses the largest-remainder method: calculate each exact proportional share from pre-header-discount line net amounts, truncate each share to two decimals, then distribute remaining cents one at a time by descending fractional remainder and finally ascending immutable line ID. Allocations must sum exactly to the header discount.
- Purchase total is line subtotal plus additional charges. Additional charges do not change inventory cost in V1.
- Current product stock is signed movement quantity aggregated by product and location.
- Supplier payable is ledger increases minus decreases. Customer receivable uses the same effect convention.
- Profit analysis later uses the selling net amount and the immutable unit-cost snapshots on sale lot allocations.

## 5. Non-functional requirements

- Critical commands execute on the server inside PostgreSQL transactions.
- Stock allocation uses row locks or an equivalent serializable strategy to prevent concurrent overselling.
- Posting commands are idempotent and uniquely constrained.
- TypeScript strict mode is required.
- Application services own business rules; React components do not post financial or inventory transactions.
- Dates are stored consistently: UTC for instants and PostgreSQL `date` for business dates.
- Data access follows least privilege; production application access should not have casual permission to delete posted transactions.

## 6. Explicitly out of scope for V1 unless approved later

- Multi-currency accounting and exchange gains/losses
- Tax/VAT/GST calculation and statutory reporting
- General ledger/double-entry accounting
- Landed-cost allocation
- Multiple inventory units and unit conversion
- Batch/serial/expiry tracking beyond purchase cost layers
- Reservations, quotations, purchase orders, and goods-received-note workflows
- Inter-location transfers and location-specific pricing
- Fine-grained permissions and approval chains
- Full audit-event infrastructure or event sourcing
- Closed accounting periods

## 7. Locked V1 business decisions

- **Currency/tax:** PKR only; no multi-currency and no GST/VAT/tax engine. Entered transaction prices are final.
- **Costing:** FIFO by `receivedAt`, then `id`. Posted allocations never change because of later backdated activity.
- **Purchases/lots:** one supplier bill is one Purchase; a Purchase may contain multiple Purchase Lots. Internal numbers use globally unique `LOT-000001`-style values; supplier lot references are optional and separate.
- **Opening inventory:** product, positive quantity, location, opening date, and positive business-approved unit cost are mandatory. Zero/unknown cost is rejected.
- **Fractional quantities:** server validation uses `UnitOfMeasure.decimalScale`; initial scales are PCS/SHEET/BOX/PACK/SET/ROLL = 0 and KG/M/FT = 3. Database storage remains `Decimal(18,4)`.
- **Discounts:** fixed or percentage input may be accepted later, but posted values are monetary amounts. Line/header limits apply, and header discounts are allocated to lines by the deterministic largest-remainder rule above.
- **Purchase charges:** additional charges never change inventory unit cost in V1.
- **Payments:** advances, overpayments, partial allocation, and fully unallocated on-account payments are allowed and preserved.
- **Returns/refunds:** returns create party ledger credit; cash settlement is a separate Payment. Original records remain intact. Purchase returns cannot exceed currently eligible lot quantity.
- **Walk-in customer:** walk-in invoices must be fully paid at posting; credit customers require a normal Customer record.
- **Backdating:** Admin and Manager may eventually backdate; Staff will not have unrestricted backdating. No closed periods are implemented in Phase 1A, and backdating never reallocates posted sales.
- **Corrections:** only Admin and Manager may eventually perform reversals/corrections; approval chains are out of scope.
- **Location:** V1 silently uses one seeded active default location while retaining location relationships for future expansion.
- **Expenses:** expenses are paid records and stay separate from inventory cost; accruals are out of scope.
- **Snapshots:** posted sales preserve customer name, phone, and address; purchases preserve supplier name, phone, and address.
- **Timezone:** reporting uses `Asia/Karachi`; true instants use UTC/PostgreSQL `timestamptz`.
- **Document numbering:** each document type has an independent, global, non-resetting sequence: Purchase `PUR-000001`, Sales Invoice `INV-000001`, Payment `PAY-000001`, Purchase Return `PRT-000001`, Sales Return `SRT-000001`, Expense `EXP-000001`, Stock Adjustment `ADJ-000001`, and Purchase Lot `LOT-000001`. Gaps are acceptable, values are never reused, and voiding/reversal/deletion does not release a number.
- **Retention:** StockFlow never automatically purges posted purchases, invoices, returns, payments, movements, lot allocations, ledger entries, or corrections. Referenced master data is deactivated rather than deleted. V1 asserts no legal retention duration; production backup and legal retention requirements are finalized during deployment hardening.

## 8. Decisions still required from the business

### Phase 3 return decision approved 2026-10-01

For a partial sale return spanning original allocations, restore those allocations in their original FIFO order (`receivedAt`, then inventory lot ID), limited by each allocation's unreturned quantity. Always use the original allocated unit cost. Credit the cumulative proportional line net selling amount after both line and allocated invoice discounts, less previously credited amounts, rounded to PKR cents. The final return clears any rounding remainder exactly. This decision was approved by the project owner during Phase 3 implementation.

Phase 3 keeps the existing operational authorization boundary: active Admin and Manager may mutate; Staff may read. Fixed PKR discounts implement the approved monetary model. Percentage-entry conveniences remain deferred.

No stock, money, numbering, or retention-policy decisions remain open for the database foundation. Deployment hardening must still define production backup retention and confirm any jurisdiction-specific legal retention duration.

## 9. Acceptance boundary for Phase 0

Phase 0 is complete when repository guidance, this requirements baseline, the database design, the Prisma proposal, and the phased development plan agree with one another. No runtime application behavior is part of Phase 0 acceptance.

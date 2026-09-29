import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env["DIRECT_URL"];

if (!databaseUrl) {
  throw new Error("DIRECT_URL is required to verify the database");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const expectedTables = [
  "Category",
  "Account",
  "Customer",
  "CustomerLedgerEntry",
  "CustomerPaymentAllocation",
  "Expense",
  "ExpenseCategory",
  "InventoryLocation",
  "InventoryLot",
  "Payment",
  "PaymentMethod",
  "Product",
  "Purchase",
  "PurchaseLine",
  "PurchaseLot",
  "PurchaseReturn",
  "PurchaseReturnLine",
  "SaleLotAllocation",
  "SaleReturn",
  "SaleReturnAllocation",
  "SaleReturnLine",
  "SalesInvoice",
  "SalesInvoiceLine",
  "Session",
  "StockAdjustment",
  "StockAdjustmentLine",
  "StockMovement",
  "Supplier",
  "SupplierLedgerEntry",
  "SupplierPaymentAllocation",
  "UnitOfMeasure",
  "User",
  "Verification",
] as const;

const expectedEnums = [
  "UserRole",
  "DocumentStatus",
  "PaymentStatus",
  "MovementDirection",
  "StockMovementType",
  "InventoryLotOrigin",
  "InventoryLotStatus",
  "BalanceEffect",
  "SupplierLedgerEntryType",
  "CustomerLedgerEntryType",
  "PaymentKind",
] as const;

const expectedConstraints = [
  "UnitOfMeasure_decimalScale_range",
  "Product_prices_nonnegative",
  "PurchaseLot_internal_number_format",
  "Purchase_amounts_valid",
  "PurchaseLine_quantity_cost_valid",
  "InventoryLot_quantity_cost_valid",
  "InventoryLot_origin_source_valid",
  "SalesInvoice_amounts_valid",
  "SalesInvoiceLine_amounts_valid",
  "StockMovement_exactly_one_source",
  "Payment_party_kind_valid",
  "Expense_amount_currency_valid",
] as const;

const expectedIndexes = ["InventoryLocation_one_active_default", "Customer_one_walk_in"] as const;

const expectedFunctions = [
  "stockflow_check_purchase_line_ownership",
  "stockflow_check_invoice_discount_allocation",
] as const;

const expectedTriggers = [
  "PurchaseLine_purchase_ownership",
  "SalesInvoice_discount_allocation_matches",
  "SalesInvoiceLine_discount_allocation_matches",
] as const;

const expectedSequences = [
  "Purchase_internal_number_seq",
  "SalesInvoice_internal_number_seq",
  "Payment_internal_number_seq",
  "PurchaseReturn_internal_number_seq",
  "SaleReturn_internal_number_seq",
  "Expense_internal_number_seq",
  "StockAdjustment_internal_number_seq",
  "PurchaseLot_internal_number_seq",
] as const;

function assertContainsAll(label: string, actual: readonly string[], expected: readonly string[]) {
  const missing = expected.filter((item) => !actual.includes(item));

  if (missing.length > 0) {
    throw new Error(`${label} verification failed; missing: ${missing.join(", ")}`);
  }

  console.info(`${label}: verified ${expected.length}`);
}

async function verifyDatabase() {
  const tables = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public'
  `;
  const constraints = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT conname AS name
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
  `;
  const enums = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT typname AS name
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typtype = 'e'
  `;
  const indexes = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT indexname AS name FROM pg_indexes WHERE schemaname = 'public'
  `;
  const functions = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT proname AS name
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
  `;
  const triggers = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT tgname AS name
    FROM pg_trigger
    WHERE NOT tgisinternal
  `;
  const sequences = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT sequencename AS name FROM pg_sequences WHERE schemaname = 'public'
  `;

  assertContainsAll(
    "Tables",
    tables.map(({ name }) => name),
    expectedTables,
  );
  assertContainsAll(
    "Enums",
    enums.map(({ name }) => name),
    expectedEnums,
  );
  assertContainsAll(
    "Custom constraints",
    constraints.map(({ name }) => name),
    expectedConstraints,
  );
  assertContainsAll(
    "Partial indexes",
    indexes.map(({ name }) => name),
    expectedIndexes,
  );
  assertContainsAll(
    "Custom functions",
    functions.map(({ name }) => name),
    expectedFunctions,
  );
  assertContainsAll(
    "Custom triggers",
    triggers.map(({ name }) => name),
    expectedTriggers,
  );
  assertContainsAll(
    "Document sequences",
    sequences.map(({ name }) => name),
    expectedSequences,
  );
}

verifyDatabase()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });

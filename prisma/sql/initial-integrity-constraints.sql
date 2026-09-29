-- Phase 1A reviewed SQL supplement for StockFlow's first Prisma migration.
-- Append this SQL to the generated initial migration BEFORE that migration is first applied.
-- This file is not an independently applied migration and must not be run against an existing schema blindly.

-- Reference/master data
ALTER TABLE "UnitOfMeasure"
  ADD CONSTRAINT "UnitOfMeasure_decimalScale_range"
  CHECK ("decimalScale" BETWEEN 0 AND 4);

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_prices_nonnegative"
  CHECK (
    ("defaultPurchasePrice" IS NULL OR "defaultPurchasePrice" >= 0)
    AND ("defaultSellingPrice" IS NULL OR "defaultSellingPrice" >= 0)
    AND "lowStockThreshold" >= 0
  );

CREATE UNIQUE INDEX "InventoryLocation_one_active_default"
  ON "InventoryLocation" ((1))
  WHERE "isDefault" = TRUE AND "isActive" = TRUE;

CREATE UNIQUE INDEX "Customer_one_walk_in"
  ON "Customer" ((1))
  WHERE "isWalkIn" = TRUE;

-- Independent, non-resetting document number sources. Gaps are expected and values are never reused.
CREATE SEQUENCE "Purchase_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE "SalesInvoice_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE "Payment_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE "PurchaseReturn_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE "SaleReturn_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE "Expense_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE "StockAdjustment_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE "PurchaseLot_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;

ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_internal_number_format"
  CHECK ("purchaseNumber" ~ '^PUR-[0-9]{6,}$');

ALTER TABLE "SalesInvoice"
  ADD CONSTRAINT "SalesInvoice_internal_number_format"
  CHECK ("invoiceNumber" ~ '^INV-[0-9]{6,}$');

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_internal_number_format"
  CHECK ("paymentNumber" ~ '^PAY-[0-9]{6,}$');

ALTER TABLE "PurchaseReturn"
  ADD CONSTRAINT "PurchaseReturn_internal_number_format"
  CHECK ("returnNumber" ~ '^PRT-[0-9]{6,}$');

ALTER TABLE "SaleReturn"
  ADD CONSTRAINT "SaleReturn_internal_number_format"
  CHECK ("returnNumber" ~ '^SRT-[0-9]{6,}$');

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_internal_number_format"
  CHECK ("expenseNumber" ~ '^EXP-[0-9]{6,}$');

ALTER TABLE "StockAdjustment"
  ADD CONSTRAINT "StockAdjustment_internal_number_format"
  CHECK ("adjustmentNumber" ~ '^ADJ-[0-9]{6,}$');

ALTER TABLE "PurchaseLot"
  ADD CONSTRAINT "PurchaseLot_internal_number_format"
  CHECK ("lotNumber" ~ '^LOT-[0-9]{6,}$');

-- Purchase and inventory quantities/costs

ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_amounts_valid"
  CHECK (
    "currencyCode" = 'PKR'
    AND "subtotal" >= 0
    AND "additionalCharges" >= 0
    AND "totalAmount" >= 0
    AND "amountPaidCached" >= 0
    AND "totalAmount" = "subtotal" + "additionalCharges"
  );

ALTER TABLE "PurchaseLine"
  ADD CONSTRAINT "PurchaseLine_quantity_cost_valid"
  CHECK (
    "quantity" > 0
    AND "unitCost" > 0
    AND "lineTotal" = round("quantity" * "unitCost", 2)
  );

ALTER TABLE "InventoryLot"
  ADD CONSTRAINT "InventoryLot_quantity_cost_valid"
  CHECK (
    "originalQuantity" > 0
    AND "availableQuantity" >= 0
    AND "availableQuantity" <= "originalQuantity"
    AND "unitCost" > 0
  ),
  ADD CONSTRAINT "InventoryLot_origin_source_valid"
  CHECK (
    ("origin" = 'PURCHASE' AND "purchaseLineId" IS NOT NULL AND "purchaseLotId" IS NOT NULL)
    OR ("origin" IN ('OPENING', 'ADJUSTMENT') AND "purchaseLineId" IS NULL AND "purchaseLotId" IS NULL)
  );

-- Sales and deterministic discounts
ALTER TABLE "SalesInvoice"
  ADD CONSTRAINT "SalesInvoice_amounts_valid"
  CHECK (
    "currencyCode" = 'PKR'
    AND "subtotal" >= 0
    AND "invoiceDiscountAmount" >= 0
    AND "invoiceDiscountAmount" <= "subtotal"
    AND "totalAmount" = "subtotal" - "invoiceDiscountAmount"
    AND "amountReceivedCached" >= 0
  );

ALTER TABLE "SalesInvoiceLine"
  ADD CONSTRAINT "SalesInvoiceLine_amounts_valid"
  CHECK (
    "quantity" > 0
    AND "unitPrice" > 0
    AND "grossAmount" = round("quantity" * "unitPrice", 2)
    AND "lineDiscountAmount" >= 0
    AND "lineDiscountAmount" <= "grossAmount"
    AND "netAmount" = "grossAmount" - "lineDiscountAmount"
    AND "invoiceDiscountAllocated" >= 0
    AND "invoiceDiscountAllocated" <= "netAmount"
  );

ALTER TABLE "SaleLotAllocation"
  ADD CONSTRAINT "SaleLotAllocation_quantity_cost_positive"
  CHECK ("quantity" > 0 AND "unitCostSnapshot" > 0);

ALTER TABLE "SaleReturnLine"
  ADD CONSTRAINT "SaleReturnLine_amounts_positive"
  CHECK ("quantity" > 0 AND "unitPriceSnapshot" > 0 AND "lineTotal" >= 0);

ALTER TABLE "SaleReturnAllocation"
  ADD CONSTRAINT "SaleReturnAllocation_quantity_cost_positive"
  CHECK ("quantity" > 0 AND "unitCostSnapshot" > 0);

ALTER TABLE "SaleReturn"
  ADD CONSTRAINT "SaleReturn_amount_currency_valid"
  CHECK ("currencyCode" = 'PKR' AND "totalAmount" >= 0);

-- Returns and adjustments
ALTER TABLE "PurchaseReturn"
  ADD CONSTRAINT "PurchaseReturn_amount_currency_valid"
  CHECK ("currencyCode" = 'PKR' AND "totalAmount" >= 0);

ALTER TABLE "PurchaseReturnLine"
  ADD CONSTRAINT "PurchaseReturnLine_amounts_positive"
  CHECK (
    "quantity" > 0
    AND "unitCost" > 0
    AND "lineTotal" = round("quantity" * "unitCost", 2)
  );

ALTER TABLE "StockAdjustmentLine"
  ADD CONSTRAINT "StockAdjustmentLine_quantity_cost_valid"
  CHECK ("quantity" > 0 AND ("unitCost" IS NULL OR "unitCost" > 0));

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_quantity_cost_valid"
  CHECK ("quantity" > 0 AND ("unitCostSnapshot" IS NULL OR "unitCostSnapshot" > 0)),
  ADD CONSTRAINT "StockMovement_exactly_one_source"
  CHECK (
    num_nonnulls(
      "purchaseLineId",
      "purchaseReturnLineId",
      "saleLotAllocationId",
      "saleReturnAllocationId",
      "adjustmentLineId"
    ) = 1
  );

-- Payments, allocations, ledgers, and paid expenses
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_party_kind_valid"
  CHECK (
    "amount" > 0
    AND "currencyCode" = 'PKR'
    AND (
      ("kind" IN ('SUPPLIER_PAYMENT', 'SUPPLIER_REFUND') AND "supplierId" IS NOT NULL AND "customerId" IS NULL)
      OR ("kind" IN ('CUSTOMER_RECEIPT', 'CUSTOMER_REFUND') AND "customerId" IS NOT NULL AND "supplierId" IS NULL)
    )
  );

ALTER TABLE "SupplierPaymentAllocation"
  ADD CONSTRAINT "SupplierPaymentAllocation_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "CustomerPaymentAllocation"
  ADD CONSTRAINT "CustomerPaymentAllocation_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "SupplierLedgerEntry"
  ADD CONSTRAINT "SupplierLedgerEntry_amount_currency_valid"
  CHECK ("amount" > 0 AND "currencyCode" = 'PKR');

ALTER TABLE "CustomerLedgerEntry"
  ADD CONSTRAINT "CustomerLedgerEntry_amount_currency_valid"
  CHECK ("amount" > 0 AND "currencyCode" = 'PKR');

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_amount_currency_valid"
  CHECK ("amount" > 0 AND "currencyCode" = 'PKR');

-- Cross-row purchase-line ownership. Deferred so nested writes can complete first.
CREATE OR REPLACE FUNCTION stockflow_check_purchase_line_ownership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "PurchaseLot" lot
    WHERE lot."id" = NEW."purchaseLotId"
      AND lot."purchaseId" = NEW."purchaseId"
  ) THEN
    RAISE EXCEPTION 'PurchaseLine purchaseId must match its PurchaseLot purchaseId';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "PurchaseLine_purchase_ownership"
AFTER INSERT OR UPDATE OF "purchaseId", "purchaseLotId" ON "PurchaseLine"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION stockflow_check_purchase_line_ownership();

-- Posted invoice line allocations must reproduce the authoritative header discount.
CREATE OR REPLACE FUNCTION stockflow_check_invoice_discount_allocation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_invoice_id uuid;
  expected numeric(18,2);
  allocated numeric(18,2);
  invoice_status "DocumentStatus";
BEGIN
  IF TG_TABLE_NAME = 'SalesInvoice' THEN
    target_invoice_id := COALESCE(NEW."id", OLD."id");
  ELSE
    target_invoice_id := COALESCE(NEW."salesInvoiceId", OLD."salesInvoiceId");
  END IF;

  SELECT "invoiceDiscountAmount", "status"
    INTO expected, invoice_status
  FROM "SalesInvoice"
  WHERE "id" = target_invoice_id;

  IF invoice_status = 'POSTED' THEN
    SELECT COALESCE(SUM("invoiceDiscountAllocated"), 0)
      INTO allocated
    FROM "SalesInvoiceLine"
    WHERE "salesInvoiceId" = target_invoice_id;

    IF allocated <> expected THEN
      RAISE EXCEPTION 'Posted invoice discount allocations (%) must equal header discount (%)', allocated, expected;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "SalesInvoice_discount_allocation_matches"
AFTER INSERT OR UPDATE OF "invoiceDiscountAmount", "status" ON "SalesInvoice"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION stockflow_check_invoice_discount_allocation();

CREATE CONSTRAINT TRIGGER "SalesInvoiceLine_discount_allocation_matches"
AFTER INSERT OR UPDATE OR DELETE ON "SalesInvoiceLine"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION stockflow_check_invoice_discount_allocation();

-- Party ownership and aggregate allocation limits are cross-row/concurrent invariants.
-- Posting services must lock the Payment and target documents, confirm matching parties,
-- and enforce SUM(allocation.amount) <= Payment.amount within one serializable transaction.
-- Return eligibility, walk-in full payment, immutable posting, and typed movement-source
-- semantics are likewise service invariants backed by the basic checks and unique keys above.

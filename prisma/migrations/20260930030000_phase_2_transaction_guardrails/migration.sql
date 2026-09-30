-- Phase 2 database guardrails for typed purchase effects and cross-row allocation invariants.

CREATE UNIQUE INDEX "PurchaseReturnLine_purchaseReturnId_purchaseLineId_key"
ON "PurchaseReturnLine"("purchaseReturnId", "purchaseLineId");

ALTER TABLE "SupplierLedgerEntry"
  ADD CONSTRAINT "SupplierLedgerEntry_source_semantics_valid"
  CHECK (
    ("entryType" = 'PURCHASE' AND "effect" = 'INCREASE' AND "purchaseId" IS NOT NULL AND "purchaseReturnId" IS NULL AND "paymentId" IS NULL)
    OR ("entryType" = 'PURCHASE_RETURN' AND "effect" = 'DECREASE' AND "purchaseId" IS NULL AND "purchaseReturnId" IS NOT NULL AND "paymentId" IS NULL)
    OR ("entryType" = 'PAYMENT' AND "effect" = 'DECREASE' AND "purchaseId" IS NULL AND "purchaseReturnId" IS NULL AND "paymentId" IS NOT NULL)
    OR ("entryType" = 'REFUND' AND "effect" = 'INCREASE' AND "purchaseId" IS NULL AND "purchaseReturnId" IS NULL AND "paymentId" IS NOT NULL)
    OR ("entryType" = 'ADJUSTMENT_INCREASE' AND "effect" = 'INCREASE' AND "purchaseId" IS NULL AND "purchaseReturnId" IS NULL AND "paymentId" IS NULL)
    OR ("entryType" = 'ADJUSTMENT_DECREASE' AND "effect" = 'DECREASE' AND "purchaseId" IS NULL AND "purchaseReturnId" IS NULL AND "paymentId" IS NULL)
    OR ("entryType" = 'REVERSAL' AND "purchaseId" IS NULL AND "purchaseReturnId" IS NULL)
  );

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_purchase_source_semantics_valid"
  CHECK (
    ("movementType" = 'PURCHASE' AND "direction" = 'IN' AND "purchaseLineId" IS NOT NULL AND "inventoryLotId" IS NOT NULL)
    OR ("movementType" = 'PURCHASE_RETURN' AND "direction" = 'OUT' AND "purchaseReturnLineId" IS NOT NULL AND "inventoryLotId" IS NOT NULL)
    OR "movementType" NOT IN ('PURCHASE', 'PURCHASE_RETURN')
  );

CREATE OR REPLACE FUNCTION stockflow_check_supplier_allocation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_payment_id uuid;
  payment_row "Payment"%ROWTYPE;
  purchase_row "Purchase"%ROWTYPE;
  allocated numeric(18,2);
BEGIN
  target_payment_id := COALESCE(NEW."paymentId", OLD."paymentId");

  SELECT * INTO payment_row FROM "Payment" WHERE "id" = target_payment_id FOR UPDATE;
  IF NOT FOUND OR payment_row."kind" <> 'SUPPLIER_PAYMENT' OR payment_row."supplierId" IS NULL THEN
    RAISE EXCEPTION 'Supplier allocation requires a supplier payment';
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT * INTO purchase_row FROM "Purchase" WHERE "id" = NEW."purchaseId" FOR UPDATE;
    IF NOT FOUND OR purchase_row."supplierId" <> payment_row."supplierId" OR purchase_row."status" <> 'POSTED' THEN
      RAISE EXCEPTION 'Supplier allocation must target a posted purchase for the same supplier';
    END IF;
  END IF;

  SELECT COALESCE(SUM("amount"), 0) INTO allocated
  FROM "SupplierPaymentAllocation"
  WHERE "paymentId" = target_payment_id;

  IF allocated > payment_row."amount" THEN
    RAISE EXCEPTION 'Supplier payment allocations exceed payment amount';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "SupplierPaymentAllocation_invariants"
AFTER INSERT OR UPDATE OR DELETE ON "SupplierPaymentAllocation"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION stockflow_check_supplier_allocation();

CREATE OR REPLACE FUNCTION stockflow_check_purchase_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_purchase_id uuid;
  header "Purchase"%ROWTYPE;
  line_sum numeric(18,2);
BEGIN
  IF TG_TABLE_NAME = 'Purchase' THEN
    target_purchase_id := COALESCE(NEW."id", OLD."id");
  ELSE
    target_purchase_id := COALESCE(NEW."purchaseId", OLD."purchaseId");
  END IF;

  SELECT * INTO header FROM "Purchase" WHERE "id" = target_purchase_id;
  IF FOUND AND header."status" = 'POSTED' THEN
    SELECT COALESCE(SUM("lineTotal"), 0) INTO line_sum FROM "PurchaseLine" WHERE "purchaseId" = target_purchase_id;
    IF line_sum <> header."subtotal" OR header."totalAmount" <> header."subtotal" + header."additionalCharges" THEN
      RAISE EXCEPTION 'Posted purchase totals do not reconcile';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "Purchase_totals_reconcile"
AFTER INSERT OR UPDATE OF "status", "subtotal", "additionalCharges", "totalAmount" ON "Purchase"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION stockflow_check_purchase_totals();

CREATE CONSTRAINT TRIGGER "PurchaseLine_totals_reconcile"
AFTER INSERT OR UPDATE OR DELETE ON "PurchaseLine"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION stockflow_check_purchase_totals();

CREATE OR REPLACE FUNCTION stockflow_check_purchase_return_line()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "PurchaseReturn" returned
    JOIN "PurchaseLine" line ON line."id" = NEW."purchaseLineId"
    JOIN "InventoryLot" inventory_lot ON inventory_lot."id" = NEW."inventoryLotId"
    WHERE returned."id" = NEW."purchaseReturnId"
      AND line."purchaseId" = returned."purchaseId"
      AND line."productId" = NEW."productId"
      AND inventory_lot."purchaseLineId" = line."id"
      AND inventory_lot."productId" = NEW."productId"
      AND inventory_lot."locationId" = returned."locationId"
  ) THEN
    RAISE EXCEPTION 'Purchase return line does not match its original purchase cost layer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "PurchaseReturnLine_source_matches"
AFTER INSERT OR UPDATE ON "PurchaseReturnLine"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION stockflow_check_purchase_return_line();

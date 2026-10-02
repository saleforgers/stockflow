-- Additive Phase 3 changes. Existing Phase 1/2 migrations remain untouched.
ALTER TABLE "Payment" ADD COLUMN "requestKey" uuid;
CREATE UNIQUE INDEX "Payment_requestKey_key" ON "Payment"("requestKey");
ALTER TABLE "SaleReturn" ADD COLUMN "requestKey" uuid;
CREATE UNIQUE INDEX "SaleReturn_requestKey_key" ON "SaleReturn"("requestKey");
ALTER TABLE "CustomerPaymentAllocation" ADD COLUMN "requestKey" uuid;
CREATE UNIQUE INDEX "CustomerPaymentAllocation_requestKey_key" ON "CustomerPaymentAllocation"("requestKey");
DROP INDEX "CustomerPaymentAllocation_paymentId_salesInvoiceId_key";
CREATE INDEX "CustomerPaymentAllocation_paymentId_salesInvoiceId_idx" ON "CustomerPaymentAllocation"("paymentId", "salesInvoiceId");
-- Fully discounted documents/returns still retain their zero-impact ledger event.
ALTER TABLE "CustomerLedgerEntry" DROP CONSTRAINT "CustomerLedgerEntry_amount_currency_valid";
ALTER TABLE "CustomerLedgerEntry" ADD CONSTRAINT "CustomerLedgerEntry_amount_currency_valid"
  CHECK ("currencyCode" = 'PKR' AND ("amount" > 0 OR ("amount" = 0 AND "entryType" IN ('SALE','SALE_RETURN'))));

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_sales_source_valid" CHECK (
  ("movementType" = 'SALE' AND "direction" = 'OUT' AND "saleLotAllocationId" IS NOT NULL AND "inventoryLotId" IS NOT NULL)
  OR ("movementType" = 'SALE_RETURN' AND "direction" = 'IN' AND "saleReturnAllocationId" IS NOT NULL AND "inventoryLotId" IS NOT NULL)
  OR "movementType" NOT IN ('SALE', 'SALE_RETURN')
);
ALTER TABLE "CustomerLedgerEntry" ADD CONSTRAINT "CustomerLedgerEntry_source_valid" CHECK (
  ("entryType" = 'SALE' AND "effect" = 'INCREASE' AND "salesInvoiceId" IS NOT NULL AND "paymentId" IS NULL AND "saleReturnId" IS NULL)
  OR ("entryType" = 'SALE_RETURN' AND "effect" = 'DECREASE' AND "saleReturnId" IS NOT NULL AND "paymentId" IS NULL AND "salesInvoiceId" IS NULL)
  OR ("entryType" = 'PAYMENT' AND "effect" = 'DECREASE' AND "paymentId" IS NOT NULL AND "salesInvoiceId" IS NULL AND "saleReturnId" IS NULL)
  OR ("entryType" = 'REFUND' AND "effect" = 'INCREASE' AND "paymentId" IS NOT NULL AND "salesInvoiceId" IS NULL AND "saleReturnId" IS NULL)
  OR ("entryType" IN ('ADJUSTMENT_INCREASE','ADJUSTMENT_DECREASE','REVERSAL') AND "salesInvoiceId" IS NULL AND "saleReturnId" IS NULL)
);

-- Once posted, financial facts and allocation audit records cannot be edited or deleted.
-- Cached invoice settlement fields remain transactionally refreshable.
CREATE FUNCTION stockflow_protect_sales_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE locked boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'SalesInvoice' THEN
    locked := OLD."status" <> 'DRAFT';
    IF locked AND TG_OP = 'UPDATE' AND
      (to_jsonb(NEW) - ARRAY['paymentStatus','amountReceivedCached','updatedAt']) =
      (to_jsonb(OLD) - ARRAY['paymentStatus','amountReceivedCached','updatedAt']) THEN RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'SalesInvoiceLine' THEN
    SELECT "status" <> 'DRAFT' INTO locked FROM "SalesInvoice" WHERE "id" = OLD."salesInvoiceId";
  ELSIF TG_TABLE_NAME = 'SaleReturn' THEN
    locked := OLD."status" <> 'DRAFT';
  ELSIF TG_TABLE_NAME = 'SaleReturnLine' THEN
    SELECT "status" <> 'DRAFT' INTO locked FROM "SaleReturn" WHERE "id" = OLD."saleReturnId";
  ELSIF TG_TABLE_NAME = 'Payment' THEN
    locked := OLD."kind" IN ('CUSTOMER_RECEIPT','CUSTOMER_REFUND') AND OLD."status" <> 'DRAFT';
  ELSIF TG_TABLE_NAME = 'StockMovement' THEN
    locked := OLD."movementType" IN ('SALE','SALE_RETURN');
  ELSE
    locked := true;
  END IF;
  IF locked THEN RAISE EXCEPTION 'Posted sales history is immutable; use an explicit correction'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "SalesInvoice_immutable" BEFORE UPDATE OR DELETE ON "SalesInvoice" FOR EACH ROW EXECUTE FUNCTION stockflow_protect_sales_history();
CREATE TRIGGER "SalesInvoiceLine_immutable" BEFORE UPDATE OR DELETE ON "SalesInvoiceLine" FOR EACH ROW EXECUTE FUNCTION stockflow_protect_sales_history();
CREATE TRIGGER "SaleReturn_immutable" BEFORE UPDATE OR DELETE ON "SaleReturn" FOR EACH ROW EXECUTE FUNCTION stockflow_protect_sales_history();
CREATE TRIGGER "SaleReturnLine_immutable" BEFORE UPDATE OR DELETE ON "SaleReturnLine" FOR EACH ROW EXECUTE FUNCTION stockflow_protect_sales_history();
CREATE TRIGGER "SaleLotAllocation_immutable" BEFORE UPDATE OR DELETE ON "SaleLotAllocation" FOR EACH ROW EXECUTE FUNCTION stockflow_protect_sales_history();
CREATE TRIGGER "SaleReturnAllocation_immutable" BEFORE UPDATE OR DELETE ON "SaleReturnAllocation" FOR EACH ROW EXECUTE FUNCTION stockflow_protect_sales_history();
CREATE TRIGGER "CustomerPaymentAllocation_immutable" BEFORE UPDATE OR DELETE ON "CustomerPaymentAllocation" FOR EACH ROW EXECUTE FUNCTION stockflow_protect_sales_history();
CREATE TRIGGER "CustomerLedgerEntry_immutable" BEFORE UPDATE OR DELETE ON "CustomerLedgerEntry" FOR EACH ROW EXECUTE FUNCTION stockflow_protect_sales_history();
CREATE TRIGGER "Payment_customer_immutable" BEFORE UPDATE OR DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION stockflow_protect_sales_history();
CREATE TRIGGER "StockMovement_sales_immutable" BEFORE UPDATE OR DELETE ON "StockMovement" FOR EACH ROW EXECUTE FUNCTION stockflow_protect_sales_history();

CREATE FUNCTION stockflow_check_customer_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "Payment"%ROWTYPE; i "SalesInvoice"%ROWTYPE; used numeric; paid numeric; credits numeric;
BEGIN
  SELECT * INTO i FROM "SalesInvoice" WHERE "id" = NEW."salesInvoiceId" FOR UPDATE;
  SELECT * INTO p FROM "Payment" WHERE "id" = NEW."paymentId" FOR UPDATE;
  IF p."kind" <> 'CUSTOMER_RECEIPT' OR p."status" <> 'POSTED' OR i."status" <> 'POSTED' OR p."customerId" <> i."customerId" THEN
    RAISE EXCEPTION 'Customer allocation requires a posted receipt and invoice for the same customer';
  END IF;
  SELECT COALESCE(sum("amount"),0) INTO used FROM "CustomerPaymentAllocation" WHERE "paymentId" = p."id";
  SELECT COALESCE(sum(a."amount"),0) INTO paid FROM "CustomerPaymentAllocation" a JOIN "Payment" p2 ON p2."id" = a."paymentId" WHERE a."salesInvoiceId" = i."id" AND p2."status" = 'POSTED';
  SELECT COALESCE(sum("totalAmount"),0) INTO credits FROM "SaleReturn" WHERE "salesInvoiceId" = i."id" AND "status" = 'POSTED';
  IF used > p."amount" OR paid > greatest(i."totalAmount" - credits, 0) THEN RAISE EXCEPTION 'Customer allocation exceeds receipt or invoice availability'; END IF;
  RETURN NEW;
END; $$;
CREATE CONSTRAINT TRIGGER "CustomerPaymentAllocation_valid" AFTER INSERT ON "CustomerPaymentAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION stockflow_check_customer_allocation();

CREATE FUNCTION stockflow_check_sale_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l "SalesInvoiceLine"%ROWTYPE; i "SalesInvoice"%ROWTYPE; lot "InventoryLot"%ROWTYPE; q numeric;
BEGIN
  SELECT * INTO l FROM "SalesInvoiceLine" WHERE "id" = NEW."salesInvoiceLineId";
  SELECT * INTO i FROM "SalesInvoice" WHERE "id" = l."salesInvoiceId" FOR UPDATE;
  SELECT * INTO lot FROM "InventoryLot" WHERE "id" = NEW."inventoryLotId";
  SELECT COALESCE(sum("quantity"),0) INTO q FROM "SaleLotAllocation" WHERE "salesInvoiceLineId" = l."id";
  IF i."status" <> 'POSTED' OR lot."productId" <> l."productId" OR lot."locationId" <> i."locationId" OR NEW."unitCostSnapshot" <> lot."unitCost" OR q <> l."quantity" THEN
    RAISE EXCEPTION 'Sale allocation does not reconcile with invoice and original cost layer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "StockMovement" m WHERE m."saleLotAllocationId" = NEW."id" AND m."inventoryLotId" = lot."id" AND m."productId" = l."productId" AND m."locationId" = i."locationId" AND m."quantity" = NEW."quantity" AND m."unitCostSnapshot" = NEW."unitCostSnapshot") THEN
    RAISE EXCEPTION 'Sale allocation movement missing or mismatched';
  END IF;
  RETURN NEW;
END; $$;
CREATE CONSTRAINT TRIGGER "SaleLotAllocation_reconciles" AFTER INSERT ON "SaleLotAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION stockflow_check_sale_allocation();

CREATE FUNCTION stockflow_check_sale_return_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "SaleLotAllocation"%ROWTYPE; l "SaleReturnLine"%ROWTYPE; r "SaleReturn"%ROWTYPE; original "SalesInvoiceLine"%ROWTYPE; q numeric; line_q numeric;
BEGIN
  SELECT * INTO l FROM "SaleReturnLine" WHERE "id" = NEW."saleReturnLineId";
  SELECT * INTO r FROM "SaleReturn" WHERE "id" = l."saleReturnId";
  PERFORM 1 FROM "SalesInvoice" WHERE "id" = r."salesInvoiceId" FOR UPDATE;
  SELECT * INTO a FROM "SaleLotAllocation" WHERE "id" = NEW."saleLotAllocationId";
  SELECT * INTO original FROM "SalesInvoiceLine" WHERE "id" = a."salesInvoiceLineId";
  SELECT COALESCE(sum("quantity"),0) INTO q FROM "SaleReturnAllocation" WHERE "saleLotAllocationId" = a."id";
  SELECT COALESCE(sum("quantity"),0) INTO line_q FROM "SaleReturnAllocation" WHERE "saleReturnLineId" = l."id";
  IF r."status" <> 'POSTED' OR a."salesInvoiceLineId" <> l."salesInvoiceLineId" OR a."inventoryLotId" <> NEW."inventoryLotId" OR a."unitCostSnapshot" <> NEW."unitCostSnapshot" OR original."salesInvoiceId" <> r."salesInvoiceId" OR original."productId" <> l."productId" OR q > a."quantity" OR line_q <> l."quantity" THEN
    RAISE EXCEPTION 'Sale return exceeds or mismatches original allocation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "StockMovement" m WHERE m."saleReturnAllocationId" = NEW."id" AND m."inventoryLotId" = NEW."inventoryLotId" AND m."quantity" = NEW."quantity" AND m."unitCostSnapshot" = NEW."unitCostSnapshot" AND m."productId" = l."productId" AND m."locationId" = r."locationId") THEN RAISE EXCEPTION 'Sale return movement missing or mismatched'; END IF;
  RETURN NEW;
END; $$;
CREATE CONSTRAINT TRIGGER "SaleReturnAllocation_reconciles" AFTER INSERT ON "SaleReturnAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION stockflow_check_sale_return_allocation();

CREATE FUNCTION stockflow_check_sales_posting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE subtotal numeric; discount numeric; paid numeric;
BEGIN
  IF NEW."status" = 'POSTED' THEN
    SELECT COALESCE(sum("netAmount"),0), COALESCE(sum("invoiceDiscountAllocated"),0) INTO subtotal,discount FROM "SalesInvoiceLine" WHERE "salesInvoiceId" = NEW."id";
    IF subtotal <> NEW."subtotal" OR discount <> NEW."invoiceDiscountAmount" OR NOT EXISTS (SELECT 1 FROM "SalesInvoiceLine" WHERE "salesInvoiceId" = NEW."id") THEN RAISE EXCEPTION 'Posted invoice totals do not reconcile'; END IF;
    IF EXISTS (SELECT 1 FROM "SalesInvoiceLine" l WHERE l."salesInvoiceId" = NEW."id" AND l."quantity" <> (SELECT COALESCE(sum(a."quantity"),0) FROM "SaleLotAllocation" a WHERE a."salesInvoiceLineId" = l."id")) THEN RAISE EXCEPTION 'Posted invoice allocation quantities do not reconcile'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "CustomerLedgerEntry" WHERE "salesInvoiceId" = NEW."id" AND "customerId" = NEW."customerId" AND "amount" = NEW."totalAmount" AND "entryType" = 'SALE') THEN RAISE EXCEPTION 'Posted invoice receivable missing'; END IF;
    IF (SELECT "isWalkIn" FROM "Customer" WHERE "id" = NEW."customerId") THEN
      SELECT COALESCE(sum(a."amount"),0) INTO paid FROM "CustomerPaymentAllocation" a JOIN "Payment" p ON p."id" = a."paymentId" WHERE a."salesInvoiceId" = NEW."id" AND p."status" = 'POSTED';
      IF paid < NEW."totalAmount" THEN RAISE EXCEPTION 'Walk-in invoice must be fully paid'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE CONSTRAINT TRIGGER "SalesInvoice_posting_reconciles" AFTER INSERT OR UPDATE OF "status" ON "SalesInvoice" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION stockflow_check_sales_posting();

CREATE FUNCTION stockflow_check_sales_credit_posting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE party uuid; total numeric;
BEGIN
  IF NEW."status" <> 'POSTED' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'SaleReturn' THEN
    SELECT "customerId" INTO party FROM "SalesInvoice" WHERE "id" = NEW."salesInvoiceId" AND "status" = 'POSTED' AND "locationId" = NEW."locationId";
    SELECT COALESCE(sum("lineTotal"),0) INTO total FROM "SaleReturnLine" WHERE "saleReturnId" = NEW."id";
    IF party IS NULL OR total <> NEW."totalAmount" OR NOT EXISTS (SELECT 1 FROM "SaleReturnLine" WHERE "saleReturnId" = NEW."id") THEN RAISE EXCEPTION 'Sale return header does not reconcile'; END IF;
    IF EXISTS (SELECT 1 FROM "SaleReturnLine" l WHERE l."saleReturnId" = NEW."id" AND l."quantity" <> (SELECT COALESCE(sum(a."quantity"),0) FROM "SaleReturnAllocation" a WHERE a."saleReturnLineId" = l."id")) THEN RAISE EXCEPTION 'Return quantity allocations do not reconcile'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "CustomerLedgerEntry" WHERE "saleReturnId" = NEW."id" AND "customerId" = party AND "amount" = total AND "entryType" = 'SALE_RETURN') THEN RAISE EXCEPTION 'Sale return credit missing'; END IF;
  ELSIF NEW."kind" = 'CUSTOMER_RECEIPT' THEN
    IF NOT EXISTS (SELECT 1 FROM "CustomerLedgerEntry" WHERE "paymentId" = NEW."id" AND "customerId" = NEW."customerId" AND "amount" = NEW."amount" AND "entryType" = 'PAYMENT') THEN RAISE EXCEPTION 'Customer receipt ledger credit missing'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE CONSTRAINT TRIGGER "SaleReturn_posting_reconciles" AFTER INSERT OR UPDATE OF "status" ON "SaleReturn" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION stockflow_check_sales_credit_posting();
CREATE CONSTRAINT TRIGGER "Payment_customer_posting_reconciles" AFTER INSERT OR UPDATE OF "status" ON "Payment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION stockflow_check_sales_credit_posting();

-- No new tables or Data API grants. Functions use invoker privileges; trigger-only access.
REVOKE ALL ON FUNCTION stockflow_protect_sales_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION stockflow_check_customer_allocation() FROM PUBLIC;
REVOKE ALL ON FUNCTION stockflow_check_sale_allocation() FROM PUBLIC;
REVOKE ALL ON FUNCTION stockflow_check_sale_return_allocation() FROM PUBLIC;
REVOKE ALL ON FUNCTION stockflow_check_sales_posting() FROM PUBLIC;
REVOKE ALL ON FUNCTION stockflow_check_sales_credit_posting() FROM PUBLIC;

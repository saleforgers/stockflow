ALTER TABLE "StockAdjustment" ADD COLUMN "requestKey" uuid;
ALTER TABLE "SalesInvoice" ADD COLUMN "requestKey" uuid;
CREATE UNIQUE INDEX "SalesInvoice_requestKey_key" ON "SalesInvoice"("requestKey");
CREATE UNIQUE INDEX "StockAdjustment_requestKey_key" ON "StockAdjustment"("requestKey");

CREATE FUNCTION stockflow_protect_adjustment_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE finalized boolean;
BEGIN
  IF TG_TABLE_NAME = 'StockMovement' THEN
    IF OLD."adjustmentLineId" IS NOT NULL THEN
      RAISE EXCEPTION 'Stock adjustment movements are immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'StockAdjustment' THEN
    IF OLD."status" <> 'DRAFT' THEN RAISE EXCEPTION 'Finalized stock adjustments are immutable'; END IF;
  ELSE
    SELECT "status" <> 'DRAFT' INTO finalized FROM "StockAdjustment" WHERE "id" = OLD."stockAdjustmentId";
    IF finalized THEN RAISE EXCEPTION 'Finalized stock adjustment items are immutable'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "StockAdjustment_immutable" BEFORE UPDATE OR DELETE ON "StockAdjustment"
  FOR EACH ROW EXECUTE FUNCTION stockflow_protect_adjustment_history();
CREATE TRIGGER "StockAdjustmentLine_immutable" BEFORE UPDATE OR DELETE ON "StockAdjustmentLine"
  FOR EACH ROW EXECUTE FUNCTION stockflow_protect_adjustment_history();
CREATE TRIGGER "StockMovement_adjustment_immutable" BEFORE UPDATE OR DELETE ON "StockMovement"
  FOR EACH ROW EXECUTE FUNCTION stockflow_protect_adjustment_history();
REVOKE ALL ON FUNCTION stockflow_protect_adjustment_history() FROM PUBLIC;

CREATE FUNCTION stockflow_check_adjustment_movement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "StockMovement" m JOIN "InventoryLot" lot ON lot."id" = NEW."inventoryLotId"
    JOIN "StockAdjustment" a ON a."id" = NEW."stockAdjustmentId"
    WHERE a."status" = 'POSTED' AND m."adjustmentLineId" = NEW."id"
      AND m."productId" = NEW."productId" AND lot."productId" = NEW."productId"
      AND m."locationId" = NEW."locationId" AND lot."locationId" = NEW."locationId"
      AND m."inventoryLotId" = NEW."inventoryLotId" AND m."direction" = NEW."direction"
      AND m."quantity" = NEW."quantity" AND m."movementType" = NEW."movementType"
      AND m."unitCostSnapshot" = NEW."unitCost" AND NEW."unitCost" = lot."unitCost"
  ) THEN RAISE EXCEPTION 'Adjustment movement missing or mismatched'; END IF;
  RETURN NEW;
END; $$;
CREATE CONSTRAINT TRIGGER "StockAdjustmentLine_movement_valid" AFTER INSERT ON "StockAdjustmentLine"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION stockflow_check_adjustment_movement();
REVOKE ALL ON FUNCTION stockflow_check_adjustment_movement() FROM PUBLIC;

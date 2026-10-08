-- Match purchaseLineAmount's one-paisa net-cost reconstruction tolerance.
-- Keep quantity and rounded FIFO unit cost positive. Invoice lineTotal remains
-- authoritative and must still equal grossAmount minus lineDiscountAmount.
ALTER TABLE "PurchaseLine"
  DROP CONSTRAINT "PurchaseLine_quantity_cost_valid",
  ADD CONSTRAINT "PurchaseLine_quantity_cost_valid"
    CHECK (
      "quantity" > 0
      AND "unitCost" > 0
      AND "lineTotal" > 0
      AND abs("lineTotal" - round("quantity" * "unitCost", 2)) <= 0.01
    );

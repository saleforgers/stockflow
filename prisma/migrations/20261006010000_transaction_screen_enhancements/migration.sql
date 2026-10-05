-- Purchase-line fixed discounts retain the entered gross price while unitCost
-- remains the authoritative net FIFO cost. Existing lines are backfilled as
-- undiscounted so historical purchases and cost layers remain unchanged.
ALTER TABLE "PurchaseLine"
  ADD COLUMN "unitPurchasePrice" DECIMAL(18,4),
  ADD COLUMN "grossAmount" DECIMAL(18,2),
  ADD COLUMN "lineDiscountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

UPDATE "PurchaseLine"
SET
  "unitPurchasePrice" = "unitCost",
  "grossAmount" = "lineTotal";

ALTER TABLE "PurchaseLine"
  ALTER COLUMN "unitPurchasePrice" SET NOT NULL,
  ALTER COLUMN "grossAmount" SET NOT NULL;

ALTER TABLE "PurchaseLine"
  ADD CONSTRAINT "PurchaseLine_unitPurchasePrice_positive_check"
    CHECK ("unitPurchasePrice" > 0),
  ADD CONSTRAINT "PurchaseLine_grossAmount_nonnegative_check"
    CHECK ("grossAmount" >= 0),
  ADD CONSTRAINT "PurchaseLine_lineDiscountAmount_nonnegative_check"
    CHECK ("lineDiscountAmount" >= 0),
  ADD CONSTRAINT "PurchaseLine_discount_not_over_gross_check"
    CHECK ("lineDiscountAmount" <= "grossAmount"),
  ADD CONSTRAINT "PurchaseLine_net_total_check"
    CHECK ("lineTotal" = "grossAmount" - "lineDiscountAmount");

-- Activate the existing expense foundation without changing inventory or purchasing costs.
ALTER TABLE "Expense" ADD COLUMN "requestKey" uuid;
ALTER TABLE "Expense" ADD COLUMN "status" "DocumentStatus" NOT NULL DEFAULT 'POSTED';
ALTER TABLE "Expense" ADD COLUMN "payeeName" text;
ALTER TABLE "Expense" ADD COLUMN "postedAt" timestamptz(6);
ALTER TABLE "Expense" ADD COLUMN "voidedAt" timestamptz(6);
ALTER TABLE "Expense" ADD COLUMN "voidedById" uuid;
ALTER TABLE "Expense" ADD COLUMN "voidReason" text;

-- Preserve any pre-feature rows as posted history and give them stable idempotency keys.
UPDATE "Expense"
SET "requestKey" = "id", "postedAt" = "createdAt"
WHERE "requestKey" IS NULL OR "postedAt" IS NULL;
ALTER TABLE "Expense" ALTER COLUMN "requestKey" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "postedAt" SET NOT NULL;

CREATE UNIQUE INDEX "Expense_requestKey_key" ON "Expense"("requestKey");
CREATE INDEX "Expense_status_expenseDate_idx" ON "Expense"("status", "expenseDate");
CREATE INDEX "Expense_createdAt_idx" ON "Expense"("createdAt");
CREATE INDEX "ExpenseCategory_isActive_name_idx" ON "ExpenseCategory"("isActive", "name");
CREATE UNIQUE INDEX "ExpenseCategory_name_normalized_key" ON "ExpenseCategory"(lower(btrim("name")));

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_voidedById_fkey"
  FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_status_valid" CHECK (
  ("status" = 'POSTED' AND "voidedAt" IS NULL AND "voidedById" IS NULL AND "voidReason" IS NULL)
  OR ("status" = 'VOID' AND "voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND length(btrim("voidReason")) > 0)
);
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_text_valid" CHECK (
  length(btrim("description")) BETWEEN 1 AND 500
  AND ("payeeName" IS NULL OR length(btrim("payeeName")) BETWEEN 1 AND 200)
  AND ("reference" IS NULL OR length(btrim("reference")) BETWEEN 1 AND 200)
  AND ("notes" IS NULL OR length(btrim("notes")) BETWEEN 1 AND 2000)
) NOT VALID;

-- Expense history is append-only. The sole permitted mutation is a complete POSTED -> VOID audit transition.
CREATE FUNCTION stockflow_protect_expense_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Expense history is immutable; void the expense instead';
  END IF;
  IF OLD."status" = 'POSTED' AND NEW."status" = 'VOID'
    AND (to_jsonb(NEW) - ARRAY['status','voidedAt','voidedById','voidReason','updatedAt']) =
        (to_jsonb(OLD) - ARRAY['status','voidedAt','voidedById','voidReason','updatedAt']) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Posted expense history is immutable; void and replace the expense';
END; $$;
CREATE TRIGGER "Expense_immutable" BEFORE UPDATE OR DELETE ON "Expense"
  FOR EACH ROW EXECUTE FUNCTION stockflow_protect_expense_history();
REVOKE ALL ON FUNCTION stockflow_protect_expense_history() FROM PUBLIC;

-- Safe, repeatable business defaults. Existing names are retained without overwriting user data.
INSERT INTO "ExpenseCategory" ("id", "name", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), seed.name, true, now(), now()
FROM (VALUES
  ('Freight / Carriage'),
  ('Loading / Unloading'),
  ('Medical'),
  ('Grocery')
) AS seed(name)
WHERE NOT EXISTS (
  SELECT 1 FROM "ExpenseCategory" existing WHERE lower(btrim(existing."name")) = lower(seed.name)
);

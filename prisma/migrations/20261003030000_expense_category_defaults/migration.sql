-- Add the two missing requested defaults without changing existing categories or expenses.
INSERT INTO "ExpenseCategory" ("id", "name", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), seed.name, true, now(), now()
FROM (VALUES ('Utilities'), ('Other')) AS seed(name)
WHERE NOT EXISTS (
  SELECT 1 FROM "ExpenseCategory" existing WHERE lower(btrim(existing."name")) = lower(seed.name)
);

-- Partial unique index: enforces uniqueness only when supplierInvoiceRef is not null.
-- Purchases without a supplier reference (NULL) remain unrestricted.
CREATE UNIQUE INDEX "purchase_supplier_invoice_ref_unique"
  ON "Purchase" ("supplierId", "supplierInvoiceRef")
  WHERE "supplierInvoiceRef" IS NOT NULL;

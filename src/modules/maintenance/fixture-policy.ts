const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const marker = new RegExp(`^(P3-IT|EXP-IT)-${uuid}$`, "i");
const testEmail = new RegExp(`^${uuid}@example\\.test$`, "i");
export function isDemoTestActor(name: string, email: string) {
  return (name === "Demo acceptance" || marker.test(name)) && testEmail.test(email);
}
export function isDemoProduct(name: string, sku: string) {
  return name === "Demo acceptance"
    ? new RegExp(`^${uuid}$`, "i").test(sku)
    : /^P3-IT-/i.test(name) && marker.test(name) && new RegExp(`^${name}-${uuid}$`, "i").test(sku);
}

// Children precede their parents. Only these known fixture tables may be changed.
export const cleanupTables = [
  "Expense",
  "Estimate",
  "SupplierLedgerEntry",
  "CustomerLedgerEntry",
  "SupplierPaymentAllocation",
  "CustomerPaymentAllocation",
  "StockMovement",
  "SaleReturnAllocation",
  "SaleLotAllocation",
  "PurchaseReturnLine",
  "SaleReturnLine",
  "StockAdjustmentLine",
  "PurchaseReturn",
  "SaleReturn",
  "SalesInvoiceLine",
  "InventoryLot",
  "PurchaseLine",
  "PurchaseLot",
  "SalesInvoice",
  "Purchase",
  "StockAdjustment",
  "Payment",
  "Product",
  "Category",
  "Supplier",
  "Customer",
  "ExpenseCategory",
  "User",
] as const;
export type CleanupTable = (typeof cleanupTables)[number];

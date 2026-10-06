import type { BusinessTransaction } from "@/lib/db/transaction";

export type DocumentNumberKind =
  | "purchase"
  | "purchaseLot"
  | "payment"
  | "purchaseReturn"
  | "salesInvoice"
  | "saleReturn"
  | "expense"
  | "stockAdjustment"
  | "estimate";

const prefixes: Record<DocumentNumberKind, string> = {
  purchase: "PUR",
  purchaseLot: "LOT",
  payment: "PAY",
  purchaseReturn: "PRT",
  salesInvoice: "INV",
  saleReturn: "SRT",
  expense: "EXP",
  stockAdjustment: "ADJ",
  estimate: "EST",
};

export async function nextDocumentNumber(
  transaction: BusinessTransaction,
  kind: DocumentNumberKind,
): Promise<string> {
  let rows: Array<{ value: bigint }>;
  switch (kind) {
    case "estimate":
      rows = await transaction.$queryRaw`SELECT nextval('"Estimate_internal_number_seq"') AS value`;
      break;
    case "stockAdjustment":
      rows =
        await transaction.$queryRaw`SELECT nextval('"StockAdjustment_internal_number_seq"') AS value`;
      break;
    case "salesInvoice":
      rows =
        await transaction.$queryRaw`SELECT nextval('"SalesInvoice_internal_number_seq"') AS value`;
      break;
    case "saleReturn":
      rows =
        await transaction.$queryRaw`SELECT nextval('"SaleReturn_internal_number_seq"') AS value`;
      break;
    case "purchase":
      rows = await transaction.$queryRaw`SELECT nextval('"Purchase_internal_number_seq"') AS value`;
      break;
    case "purchaseLot":
      rows =
        await transaction.$queryRaw`SELECT nextval('"PurchaseLot_internal_number_seq"') AS value`;
      break;
    case "payment":
      rows = await transaction.$queryRaw`SELECT nextval('"Payment_internal_number_seq"') AS value`;
      break;
    case "purchaseReturn":
      rows =
        await transaction.$queryRaw`SELECT nextval('"PurchaseReturn_internal_number_seq"') AS value`;
      break;
    case "expense":
      rows = await transaction.$queryRaw`SELECT nextval('"Expense_internal_number_seq"') AS value`;
      break;
  }

  const value = rows[0]?.value;
  if (value === undefined) throw new Error(`Could not allocate ${kind} number`);
  return `${prefixes[kind]}-${value.toString().padStart(6, "0")}`;
}

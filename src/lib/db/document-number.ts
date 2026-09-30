import type { BusinessTransaction } from "@/lib/db/transaction";

export type DocumentNumberKind = "purchase" | "purchaseLot" | "payment" | "purchaseReturn";

const prefixes: Record<DocumentNumberKind, string> = {
  purchase: "PUR",
  purchaseLot: "LOT",
  payment: "PAY",
  purchaseReturn: "PRT",
};

export async function nextDocumentNumber(
  transaction: BusinessTransaction,
  kind: DocumentNumberKind,
): Promise<string> {
  let rows: Array<{ value: bigint }>;
  switch (kind) {
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
  }

  const value = rows[0]?.value;
  if (value === undefined) throw new Error(`Could not allocate ${kind} number`);
  return `${prefixes[kind]}-${value.toString().padStart(6, "0")}`;
}

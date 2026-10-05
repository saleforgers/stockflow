import { requireUser } from "@/lib/auth/session";
import { pdfResponse, simpleTextPdf } from "@/lib/pdf/simple-pdf";
import { getSupplierAccount } from "@/modules/purchases/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const account = await getSupplierAccount(id);
  if (!account.supplier) return new Response("Supplier not found", { status: 404 });
  const lines = [
    `Supplier: ${account.supplier.name}`,
    "Date range: All activity",
    `Opening balance: PKR ${account.summary.openingBalance}`,
    "",
    "Date | Reference | Description | Debit | Credit | Running Balance",
    ...account.statement.map((entry) => {
      const reference =
        entry.purchase?.purchaseNumber ??
        entry.payment?.paymentNumber ??
        entry.purchaseReturn?.returnNumber ??
        entry.reference ??
        "-";
      return `${entry.entryDate.toISOString().slice(0, 10)} | ${reference} | ${entry.entryType.replaceAll("_", " ")}${entry.reason ? ` - ${entry.reason}` : ""} | ${entry.effect === "DECREASE" ? `PKR ${entry.amount.toFixed(2)}` : "-"} | ${entry.effect === "INCREASE" ? `PKR ${entry.amount.toFixed(2)}` : "-"} | PKR ${entry.runningBalance}`;
    }),
    "",
    `Closing balance: PKR ${account.payable}`,
  ];
  return pdfResponse(
    `supplier-${account.supplier.name}-statement.pdf`,
    simpleTextPdf("StockFlow Supplier Statement", lines),
  );
}

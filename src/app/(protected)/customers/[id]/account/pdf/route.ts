import { getCurrentUser } from "@/lib/auth/session";
import { pdfResponse, simpleTextPdf } from "@/lib/pdf/simple-pdf";
import { getCustomerAccount } from "@/modules/sales/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const account = await getCustomerAccount(id);
  if (!account?.customer) return new Response("Customer not found", { status: 404 });
  const lines = [
    `Customer: ${account.customer.name}`,
    "Date range: All activity",
    `Opening balance: PKR ${account.summary.openingBalance}`,
    "",
    "Date | Reference | Description | Debit | Credit | Running Balance",
    ...account.statement.map(
      (entry) =>
        `${entry.entryDate.toISOString().slice(0, 10)} | ${entry.reference ?? "-"} | ${entry.entryType.replaceAll("_", " ")}${entry.reason ? ` - ${entry.reason}` : ""} | ${entry.effect === "INCREASE" ? `PKR ${entry.amount.toFixed(2)}` : "-"} | ${entry.effect === "DECREASE" ? `PKR ${entry.amount.toFixed(2)}` : "-"} | PKR ${entry.runningBalance}`,
    ),
    "",
    `Closing balance: PKR ${account.receivable}`,
  ];
  return pdfResponse(
    `customer-${account.customer.name}-statement.pdf`,
    simpleTextPdf("StockFlow Customer Statement", lines),
  );
}

import { getStatement } from "./queries";
import { getCurrentUser } from "@/lib/auth/session";
import { formatPkr, formatDate, currentBusinessDate } from "@/lib/format";
import { businessLabel } from "@/lib/labels";
import { createBusinessPdf, pdfResponse } from "@/modules/documents/pdf";
export async function statementPdf(request: Request, id: string, kind: "customer" | "supplier") {
  if (!(await getCurrentUser())) return new Response("Authentication required", { status: 401 });
  const q = new URL(request.url).searchParams;
  const account = await getStatement(kind, id, {
    page: 1,
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
    export: true,
  });
  if (!account) return new Response("Account not found", { status: 404 });
  if (account.total > 10000)
    return new Response("Please choose a smaller date range (maximum 10,000 entries per PDF).", {
      status: 422,
    });
  const customer = kind === "customer";
  const bytes = await createBusinessPdf({
    title: customer ? "CUSTOMER STATEMENT" : "SUPPLIER STATEMENT",
    number: `Statement-${currentBusinessDate()}`,
    date: currentBusinessDate(),
    partyLabel: customer ? "Customer" : "Supplier",
    party: [account.party.name, account.party.phone ?? "", account.party.address ?? ""],
    metadata: [
      `Date Range: ${q.get("from") || "Beginning"} to ${q.get("to") || "Present"}`,
      `Opening Balance: ${formatPkr(account.opening)}`,
    ],
    columns: [
      { label: "Date", width: 65 },
      { label: "Reference", width: 85 },
      { label: "Description", width: 125 },
      { label: customer ? "Invoice / Debit" : "Purchase / Debit", width: 80, right: true },
      { label: "Payment / Credit", width: 80, right: true },
      { label: "Balance", width: 80, right: true },
    ],
    rows: account.rows.map((e) => [
      formatDate(e.entryDate),
      e.reference ?? "",
      businessLabel(e.entryType) + (e.reason ? " · " + e.reason : ""),
      e.effect === "INCREASE" ? e.amount.toFixed(2) : "",
      e.effect === "DECREASE" ? e.amount.toFixed(2) : "",
      e.balance.toFixed(2),
    ]),
    totals: [
      { label: "Closing Balance", value: formatPkr(account.closing), strong: true },
      {
        label: customer ? "Current Outstanding" : "Current Payable",
        value: formatPkr(account.outstanding),
      },
      { label: "Current Credit", value: formatPkr(account.credit) },
    ],
    notes: "Negative balances represent credit on the account.",
  });
  return pdfResponse(
    bytes,
    `${customer ? "Customer" : "Supplier"}-Statement-${currentBusinessDate()}.pdf`,
    q.get("inline") === "1",
  );
}

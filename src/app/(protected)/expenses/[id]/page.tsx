import { businessLabel } from "@/lib/labels";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentHeading, DocumentTotals } from "@/components/ui/document-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatPkr } from "@/lib/format";
import { voidExpenseAction } from "@/modules/expenses/actions";
import { VoidExpenseForm } from "@/modules/expenses/forms";
import { getExpense } from "@/modules/expenses/queries";

export default async function ExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const expense = await getExpense(id);
  if (!expense) notFound();
  const canVoid = user.role !== "STAFF" && expense.status === "POSTED";
  return (
    <>
      <PageHeader
        title={expense.expenseNumber}
        description={`${expense.expenseCategory.name} · ${formatDate(expense.expenseDate)} · ${businessLabel(expense.status)}`}
      />
      <div>
        <Link className="btn-secondary" href="/expenses">
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Expense History
        </Link>
      </div>
      {query.success ? (
        <div className="alert-success" role="status">
          {query.success === "voided"
            ? "Expense voided. The original record remains in history."
            : "Expense saved successfully."}
        </div>
      ) : null}
      <section className="card invoice-document">
        <DocumentHeading
          title="Expense voucher"
          description={`${expense.expenseNumber} · ${formatDate(expense.expenseDate)}`}
          aside={
            <StatusBadge
              active={expense.status === "POSTED"}
              label={businessLabel(expense.status)}
            />
          }
        />
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid content-start gap-5 sm:grid-cols-2">
            <Detail label="Category" value={expense.expenseCategory.name} />
            <Detail label="Description" value={expense.description} />
            <Detail label="Paid To" value={expense.payeeName} />
            <Detail label="Reference" value={expense.reference} />
            <Detail label="Created By" value={expense.createdBy.name} />
            <Detail
              label="Created"
              value={expense.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}
            />
            <Detail
              label="Recorded"
              value={expense.postedAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}
            />
            <Detail
              label="Last Updated"
              value={expense.updatedAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}
            />
            <Detail label="Notes" value={expense.notes} />
            {expense.status === "VOID" ? (
              <>
                <Detail label="Voided By" value={expense.voidedBy?.name} />
                <Detail label="Void Reason" value={expense.voidReason} />
                <Detail
                  label="Voided"
                  value={expense.voidedAt?.toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}
                />
              </>
            ) : null}
          </div>
          <DocumentTotals title="Expense amount">
            <p className="text-3xl font-semibold text-indigo-900">{formatPkr(expense.amount)}</p>
            <Detail label="Payment Method" value={expense.paymentMethod.name} />
            <p className="text-xs text-slate-500">Paid operating expense</p>
          </DocumentTotals>
        </div>
      </section>
      {canVoid ? <VoidExpenseForm action={voidExpenseAction.bind(null, expense.id)} /> : null}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

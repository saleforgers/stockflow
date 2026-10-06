import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import Decimal from "decimal.js";
import { requireRole } from "@/lib/auth/session";
import { currentBusinessDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { getInvoice } from "@/modules/sales/queries";
import { ReturnForm } from "@/modules/sales/forms";
import { returnAction } from "@/modules/sales/actions";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  if (invoice.status !== "POSTED") redirect(`/sales/${id}`);
  const lines = invoice.lines
    .map((l) => ({
      id: l.id,
      original: l.quantity.toFixed(),
      returned: l.returnLines
        .reduce((s, r) => s.plus(r.quantity.toString()), new Decimal(0))
        .toFixed(),
      name: `${l.skuSnapshot} — ${l.productNameSnapshot} (${l.uomCodeSnapshot})`,
      remaining: new Decimal(l.quantity.toString())
        .minus(l.returnLines.reduce((s, r) => s.plus(r.quantity.toString()), new Decimal(0)))
        .toFixed(),
    }))
    .filter((l) => new Decimal(l.remaining).gt(0));
  return (
    <>
      <PageHeader title={`Return against ${invoice.invoiceNumber}`} />
      {lines.length ? (
        <ReturnForm
          action={returnAction}
          invoiceId={id}
          lines={lines}
          date={currentBusinessDate()}
          requestKey={randomUUID()}
        />
      ) : (
        <p>All quantities have been returned.</p>
      )}
    </>
  );
}

import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { InvoiceForm } from "@/modules/sales/forms";
import { getInvoice, getSalesOptions } from "@/modules/sales/queries";
import { saveInvoiceAction } from "@/modules/sales/actions";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await params;
  const [invoice, options] = await Promise.all([getInvoice(id), getSalesOptions(false)]);
  if (!invoice) notFound();
  if (invoice.status !== "DRAFT") redirect(`/sales/${id}`);
  return (
    <>
      <PageHeader title={`Edit ${invoice.invoiceNumber}`} />
      <InvoiceForm
        action={saveInvoiceAction.bind(null, id)}
        customers={options.customers}
        products={options.products}
        methods={options.paymentMethods}
        date={invoice.invoiceDate.toISOString().slice(0, 10)}
        initial={{
          customerId: invoice.customerId,
          invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
          invoiceDiscountAmount: invoice.invoiceDiscountAmount.toFixed(2),
          notes: invoice.notes,
          lines: invoice.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity.toFixed(),
            unitPrice: l.unitPrice.toFixed(),
            lineDiscountAmount: l.lineDiscountAmount.toFixed(2),
            notes: l.notes,
          })),
        }}
      />
    </>
  );
}

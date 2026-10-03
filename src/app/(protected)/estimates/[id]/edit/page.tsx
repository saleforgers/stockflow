import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceForm } from "@/modules/sales/forms";
import { getSalesOptions } from "@/modules/sales/queries";
import { getEstimate } from "@/modules/estimates/queries";
import { estimateItems } from "@/modules/estimates/services";
import { saveEstimateAction } from "@/modules/estimates/actions";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await params;
  const [estimate, options] = await Promise.all([getEstimate(id), getSalesOptions(false)]);
  if (!estimate) notFound();
  if (["CONVERTED", "CANCELLED"].includes(estimate.status)) redirect(`/estimates/${id}`);
  const date = estimate.estimateDate.toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title={`Edit ${estimate.estimateNumber}`} />
      <InvoiceForm
        estimate
        validUntil={estimate.validUntil?.toISOString().slice(0, 10)}
        action={saveEstimateAction.bind(null, id)}
        customers={options.customers}
        products={options.products}
        date={date}
        initial={{
          requestKey: estimate.requestKey,
          customerId: estimate.customerId,
          invoiceDate: date,
          invoiceDiscountAmount: estimate.invoiceDiscountAmount.toFixed(2),
          notes: estimate.notes,
          lines: estimateItems(estimate.lines),
        }}
      />
    </>
  );
}

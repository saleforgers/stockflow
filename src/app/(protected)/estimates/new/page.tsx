import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/session";
import { currentBusinessDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceForm } from "@/modules/sales/forms";
import { getSalesOptions } from "@/modules/sales/queries";
import { saveEstimateAction } from "@/modules/estimates/actions";
export default async function Page() {
  await requireRole(["ADMIN", "MANAGER"]);
  const options = await getSalesOptions(false);
  return (
    <>
      <PageHeader title="New Estimate / Quotation" />
      <InvoiceForm
        estimate
        action={saveEstimateAction.bind(null, null)}
        customers={options.customers}
        products={options.products}
        date={currentBusinessDate()}
        requestKey={randomUUID()}
      />
    </>
  );
}

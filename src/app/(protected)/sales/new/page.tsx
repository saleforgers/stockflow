import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { currentBusinessDate } from "@/lib/format";
import { InvoiceForm } from "@/modules/sales/forms";
import { getSalesOptions } from "@/modules/sales/queries";
import { saveInvoiceAction } from "@/modules/sales/actions";
import { randomUUID } from "node:crypto";
export default async function Page() {
  await requireRole(["ADMIN", "MANAGER"]);
  const options = await getSalesOptions(false);
  return (
    <>
      <PageHeader title="New sales invoice" />
      <InvoiceForm
        action={saveInvoiceAction.bind(null, null)}
        customers={options.customers}
        products={options.products}
        methods={options.paymentMethods}
        requestKey={randomUUID()}
        date={currentBusinessDate()}
      />
    </>
  );
}

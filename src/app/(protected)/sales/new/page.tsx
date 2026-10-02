import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { currentBusinessDate } from "@/lib/format";
import { InvoiceForm } from "@/modules/sales/forms";
import { getSalesOptions } from "@/modules/sales/queries";
import { saveInvoiceAction } from "@/modules/sales/actions";
export default async function Page() {
  await requireRole(["ADMIN", "MANAGER"]);
  const options = await getSalesOptions();
  return (
    <>
      <PageHeader title="New sales invoice" />
      <InvoiceForm
        action={saveInvoiceAction.bind(null, null)}
        customers={options.customers}
        products={options.products}
        date={currentBusinessDate()}
      />
    </>
  );
}

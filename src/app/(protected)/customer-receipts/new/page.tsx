import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/session";
import { currentBusinessDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { getSalesOptions } from "@/modules/sales/queries";
import { ReceiptForm } from "@/modules/sales/forms";
import { receiptAction } from "@/modules/sales/actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  await requireRole(["ADMIN", "MANAGER"]);
  const [options, params] = await Promise.all([getSalesOptions(), searchParams]);
  return (
    <>
      <PageHeader title="Customer receipt" />
      <ReceiptForm
        action={receiptAction}
        customers={options.customers}
        methods={options.paymentMethods}
        invoices={options.invoices}
        date={currentBusinessDate()}
        requestKey={randomUUID()}
        customerId={params.customerId ?? ""}
      />
    </>
  );
}

import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { currentBusinessDate } from "@/lib/format";
import { recordSupplierPaymentAction } from "@/modules/purchases/actions";
import { getSupplierPaymentOptions } from "@/modules/purchases/queries";
import { SupplierPaymentForm } from "@/modules/purchases/supplier-payment-form";

export default async function NewSupplierPaymentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["ADMIN", "MANAGER"]);
  const [params, options] = await Promise.all([searchParams, getSupplierPaymentOptions()]);
  return (
    <>
      <PageHeader
        title="Record supplier payment"
        description="Record a payment against outstanding purchases or as an advance."
      />
      <SupplierPaymentForm
        action={recordSupplierPaymentAction}
        {...options}
        defaultDate={currentBusinessDate()}
        initialSupplierId={params.supplierId}
      />
    </>
  );
}

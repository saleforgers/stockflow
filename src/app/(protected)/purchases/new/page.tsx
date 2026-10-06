import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { currentBusinessDate } from "@/lib/format";
import { createPurchaseDraftAction } from "@/modules/purchases/actions";
import { PurchaseForm } from "@/modules/purchases/purchase-form";
import { getPurchaseFormOptions } from "@/modules/purchases/queries";
import { quickCreateSupplierAction } from "@/modules/suppliers/actions";

export default async function NewPurchasePage() {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const options = await getPurchaseFormOptions();
  const date = currentBusinessDate();
  return (
    <>
      <PageHeader
        title="New purchase"
        description="Record one supplier bill with one or more received lots."
      />
      <PurchaseForm
        action={createPurchaseDraftAction}
        {...options}
        defaultDate={date}
        defaultReceivedAt={`${date}T12:00`}
        quickCreateAction={user.role === "ADMIN" ? quickCreateSupplierAction : undefined}
      />
    </>
  );
}

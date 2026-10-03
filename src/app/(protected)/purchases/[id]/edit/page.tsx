import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { karachiDateTimeInput } from "@/lib/format";
import { updatePurchaseDraftAction } from "@/modules/purchases/actions";
import { PurchaseForm, type PurchaseFormValue } from "@/modules/purchases/purchase-form";
import { getPurchase, getPurchaseFormOptions } from "@/modules/purchases/queries";

export default async function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await params;
  const [purchase, options] = await Promise.all([getPurchase(id), getPurchaseFormOptions()]);
  if (!purchase) notFound();
  if (purchase.status !== "DRAFT")
    return (
      <>
        <PageHeader
          title="Purchase cannot be edited"
          description="Finalized purchases cannot be edited. Use a return or correction."
        />
      </>
    );
  const initial: PurchaseFormValue = {
    supplierId: purchase.supplierId,
    purchaseDate: purchase.purchaseDate.toISOString().slice(0, 10),
    supplierInvoiceRef: purchase.supplierInvoiceRef ?? "",
    additionalCharges: purchase.additionalCharges.toFixed(2),
    notes: purchase.notes ?? "",
    lots: purchase.lots.map((lot) => ({
      key: lot.id,
      id: lot.id,
      supplierLotReference: lot.supplierLotReference ?? "",
      receivedAt: karachiDateTimeInput(lot.receivedAt),
      notes: lot.notes ?? "",
      lines: lot.lines.map((line) => ({
        key: line.id,
        productId: line.productId,
        quantity: line.quantity.toFixed(),
        unitCost: line.unitCost.toFixed(4),
        notes: line.notes ?? "",
      })),
    })),
  };
  return (
    <>
      <PageHeader
        title={`Edit ${purchase.purchaseNumber}`}
        description="Draft changes update stock and the supplier account only when you finalize."
      />
      <PurchaseForm
        action={updatePurchaseDraftAction.bind(null, id)}
        initial={initial}
        {...options}
        defaultDate={initial.purchaseDate}
        defaultReceivedAt={`${initial.purchaseDate}T12:00`}
      />
    </>
  );
}

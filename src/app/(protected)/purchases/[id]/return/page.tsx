import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { decimal } from "@/lib/decimal/decimal";
import { currentBusinessDate, formatQuantity } from "@/lib/format";
import { postPurchaseReturnAction } from "@/modules/purchases/actions";
import { getPurchase } from "@/modules/purchases/queries";
import { PurchaseReturnForm } from "@/modules/purchases/purchase-return-form";

export default async function PurchaseReturnPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await params;
  const purchase = await getPurchase(id);
  if (!purchase || purchase.status !== "POSTED") notFound();
  const lines = purchase.lots.flatMap((lot) =>
    lot.lines.flatMap((line) =>
      line.inventoryLot && decimal(line.inventoryLot.availableQuantity).greaterThan(0)
        ? [
            {
              id: line.id,
              sku: line.skuSnapshot,
              name: line.productNameSnapshot,
              uom: line.uomCodeSnapshot,
              available: formatQuantity(line.inventoryLot.availableQuantity),
              unitCost: line.unitCost.toFixed(4),
            },
          ]
        : [],
    ),
  );
  return (
    <>
      <PageHeader
        title="Purchase return"
        description={`Return eligible stock from ${purchase.purchaseNumber}. This creates supplier credit, not a cash refund.`}
      />
      {lines.length ? (
        <PurchaseReturnForm
          action={postPurchaseReturnAction}
          purchaseId={purchase.id}
          purchaseNumber={purchase.purchaseNumber}
          defaultDate={currentBusinessDate()}
          lines={lines}
        />
      ) : (
        <div className="card p-6 text-sm text-slate-600">
          No eligible lot quantity remains to return.
        </div>
      )}
    </>
  );
}

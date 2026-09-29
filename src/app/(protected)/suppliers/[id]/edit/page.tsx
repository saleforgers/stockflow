import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { updateSupplierAction } from "@/modules/suppliers/actions";
import { getSupplier } from "@/modules/suppliers/queries";
import { SupplierForm } from "@/modules/suppliers/supplier-form";
export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN"]);
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();
  return (
    <>
      <PageHeader
        title="Edit supplier"
        description="Historical purchase snapshots will remain unchanged by later master-data edits."
      />
      <SupplierForm action={updateSupplierAction.bind(null, id)} supplier={supplier} />
    </>
  );
}

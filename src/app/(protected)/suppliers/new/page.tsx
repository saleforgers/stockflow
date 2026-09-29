import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { createSupplierAction } from "@/modules/suppliers/actions";
import { SupplierForm } from "@/modules/suppliers/supplier-form";
export default async function NewSupplierPage() {
  await requireRole(["ADMIN"]);
  return (
    <>
      <PageHeader
        title="New supplier"
        description="Add a supplier master record without creating financial history."
      />
      <SupplierForm action={createSupplierAction} />
    </>
  );
}

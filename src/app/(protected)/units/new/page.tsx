import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { createUnitAction } from "@/modules/units/actions";
import { UnitForm } from "@/modules/units/unit-form";
export default async function NewUnitPage() {
  await requireRole(["ADMIN"]);
  return (
    <>
      <PageHeader
        title="New unit"
        description="Define the product's primary inventory measurement."
      />
      <UnitForm action={createUnitAction} />
    </>
  );
}

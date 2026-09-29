import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { updateUnitAction } from "@/modules/units/actions";
import { getUnit } from "@/modules/units/queries";
import { UnitForm } from "@/modules/units/unit-form";
export default async function EditUnitPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN"]);
  const { id } = await params;
  const unit = await getUnit(id);
  if (!unit) notFound();
  return (
    <>
      <PageHeader
        title="Edit unit"
        description="Decimal scale is locked once products reference this unit."
      />
      <UnitForm action={updateUnitAction.bind(null, id)} unit={unit} />
    </>
  );
}

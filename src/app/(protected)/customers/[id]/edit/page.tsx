import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { updateCustomerAction } from "@/modules/customers/actions";
import { CustomerForm } from "@/modules/customers/customer-form";
import { getCustomer } from "@/modules/customers/queries";
export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN"]);
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer || customer.isWalkIn) notFound();
  return (
    <>
      <PageHeader
        title="Edit customer"
        description="Historical invoice party snapshots will remain unchanged."
      />
      <CustomerForm action={updateCustomerAction.bind(null, id)} customer={customer} />
    </>
  );
}

import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { createCustomerAction } from "@/modules/customers/actions";
import { CustomerForm } from "@/modules/customers/customer-form";
export default async function NewCustomerPage() {
  await requireRole(["ADMIN"]);
  return (
    <>
      <PageHeader
        title="New customer"
        description="Credit customers must use their own normal customer record."
      />
      <CustomerForm action={createCustomerAction} />
    </>
  );
}

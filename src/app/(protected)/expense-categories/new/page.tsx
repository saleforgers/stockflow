import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { createExpenseCategoryAction } from "@/modules/expenses/actions";
import { ExpenseCategoryForm } from "@/modules/expenses/forms";

export default async function NewExpenseCategoryPage() {
  await requireRole(["ADMIN"]);
  return (
    <>
      <PageHeader title="New Expense Category" />
      <ExpenseCategoryForm action={createExpenseCategoryAction} />
    </>
  );
}

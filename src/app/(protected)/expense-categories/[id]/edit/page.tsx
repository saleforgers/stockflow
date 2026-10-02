import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { updateExpenseCategoryAction } from "@/modules/expenses/actions";
import { ExpenseCategoryForm } from "@/modules/expenses/forms";
import { getExpenseCategory } from "@/modules/expenses/queries";

export default async function EditExpenseCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN"]);
  const { id } = await params;
  const category = await getExpenseCategory(id);
  if (!category) notFound();
  return (
    <>
      <PageHeader title={`Edit ${category.name}`} />
      <ExpenseCategoryForm
        action={updateExpenseCategoryAction.bind(null, id)}
        category={category}
      />
    </>
  );
}

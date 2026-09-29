import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { createCategoryAction } from "@/modules/categories/actions";
import { CategoryForm } from "@/modules/categories/category-form";
import { getCategoryOptions } from "@/modules/categories/queries";

export default async function NewCategoryPage() {
  await requireRole(["ADMIN"]);
  return (
    <>
      <PageHeader title="New category" description="Create a reusable product grouping." />
      <CategoryForm action={createCategoryAction} parents={await getCategoryOptions()} />
    </>
  );
}

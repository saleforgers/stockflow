import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { updateCategoryAction } from "@/modules/categories/actions";
import { CategoryForm } from "@/modules/categories/category-form";
import { getCategory, getCategoryOptions } from "@/modules/categories/queries";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN"]);
  const { id } = await params;
  const [category, parents] = await Promise.all([getCategory(id), getCategoryOptions(id)]);
  if (!category) notFound();
  return (
    <>
      <PageHeader
        title="Edit category"
        description="Changes affect future catalogue use; historical records remain linked."
      />
      <CategoryForm
        action={updateCategoryAction.bind(null, id)}
        category={category}
        parents={parents}
      />
    </>
  );
}

import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { createProductAction } from "@/modules/products/actions";
import { ProductForm } from "@/modules/products/product-form";
import { getProductFormOptions } from "@/modules/products/queries";
export default async function NewProductPage() {
  await requireRole(["ADMIN"]);
  const options = await getProductFormOptions();
  return (
    <>
      <PageHeader
        title="New product"
        description="Create one SKU for this exact stocked and sellable combination."
      />
      <ProductForm action={createProductAction} {...options} />
    </>
  );
}

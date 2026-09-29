import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { updateProductAction } from "@/modules/products/actions";
import { ProductForm } from "@/modules/products/product-form";
import { getProduct, getProductFormOptions } from "@/modules/products/queries";
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN"]);
  const { id } = await params;
  const [product, options] = await Promise.all([getProduct(id), getProductFormOptions()]);
  if (!product) notFound();
  const specs =
    typeof product.specifications === "object" &&
    product.specifications &&
    !Array.isArray(product.specifications)
      ? Object.entries(product.specifications).map(([key, value]) => ({
          key,
          value: String(value),
        }))
      : [];
  return (
    <>
      <PageHeader
        title={`Edit ${product.sku}`}
        description="Default prices and master details do not rewrite historical transactions."
      />
      <ProductForm
        action={updateProductAction.bind(null, id)}
        categories={options.categories}
        units={options.units}
        suppliers={options.suppliers}
        product={{
          sku: product.sku,
          name: product.name,
          description: product.description,
          categoryId: product.categoryId,
          inventoryUnitId: product.inventoryUnitId,
          preferredSupplierId: product.preferredSupplierId,
          defaultPurchasePrice: product.defaultPurchasePrice?.toFixed() ?? null,
          defaultSellingPrice: product.defaultSellingPrice?.toFixed() ?? null,
          lowStockThreshold: product.lowStockThreshold.toFixed(),
          specifications: specs,
        }}
      />
    </>
  );
}

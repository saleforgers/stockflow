import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { getProduct } from "@/modules/products/queries";
export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const [product, user, query] = await Promise.all([
    getProduct(id),
    getCurrentUser(),
    searchParams,
  ]);
  if (!product) notFound();
  const specs =
    typeof product.specifications === "object" &&
    product.specifications &&
    !Array.isArray(product.specifications)
      ? Object.entries(product.specifications)
      : [];
  return (
    <>
      <PageHeader
        title={product.name}
        description={product.sku}
        actionHref={user?.role === "ADMIN" ? `/products/${id}/edit` : undefined}
        actionLabel="Edit product"
      />
      {query.success ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Product saved successfully.
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Product details</h2>
            <StatusBadge active={product.isActive} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
            <dt className="text-slate-500">Category</dt>
            <dd>{product.category.name}</dd>
            <dt className="text-slate-500">Unit</dt>
            <dd>
              {product.inventoryUnit.code} — {product.inventoryUnit.name}
            </dd>
            <dt className="text-slate-500">Preferred supplier</dt>
            <dd>{product.preferredSupplier?.name ?? "—"}</dd>
            <dt className="text-slate-500">Default purchase</dt>
            <dd>
              {product.defaultPurchasePrice
                ? `PKR ${product.defaultPurchasePrice.toFixed(2)}`
                : "—"}
            </dd>
            <dt className="text-slate-500">Default selling</dt>
            <dd>
              {product.defaultSellingPrice ? `PKR ${product.defaultSellingPrice.toFixed(2)}` : "—"}
            </dd>
            <dt className="text-slate-500">Low-stock threshold</dt>
            <dd>
              {product.lowStockThreshold.toFixed()} {product.inventoryUnit.code}
            </dd>
          </dl>
          <p className="mt-5 border-t border-slate-200 pt-5 text-sm leading-6 text-slate-600">
            {product.description ?? "No description."}
          </p>
        </section>
        <section className="card p-6">
          <h2 className="font-semibold text-slate-900">Specifications</h2>
          {specs.length ? (
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
              {specs.flatMap(([key, value]) => [
                <dt className="text-slate-500" key={`${key}-k`}>
                  {key.replaceAll("_", " ")}
                </dt>,
                <dd key={`${key}-v`}>{String(value)}</dd>,
              ])}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No specifications recorded.</p>
          )}
        </section>
      </div>
      <Link className="btn-secondary" href="/products">
        Back to products
      </Link>
    </>
  );
}

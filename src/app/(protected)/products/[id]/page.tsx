import Link from "next/link";
import { listStock, listLots, listMovements } from "@/modules/inventory/queries";
import { LotsTable, MovementsTable } from "@/modules/inventory/views";
import { SummaryCards } from "@/components/ui/summary-cards";
import { formatPkr, formatQuantity } from "@/lib/format";
import { prisma } from "@/lib/db/prisma";
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
  const [stock, lots, movements, purchases, sales] = await Promise.all([
    listStock({ page: 1, productId: id }),
    listLots({ page: 1, productId: id }),
    listMovements({ page: 1, productId: id }),
    prisma.purchaseLine.findMany({
      where: { productId: id, purchase: { status: "POSTED" } },
      include: { purchase: true },
      orderBy: { purchase: { purchaseDate: "desc" } },
      take: 10,
    }),
    prisma.salesInvoiceLine.findMany({
      where: { productId: id, salesInvoice: { status: "POSTED" } },
      include: { salesInvoice: true },
      orderBy: { salesInvoice: { invoiceDate: "desc" } },
      take: 10,
    }),
  ]);
  const current = stock.items[0];
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
      <SummaryCards
        items={[
          {
            label: "On Hand",
            value: formatQuantity(current?.onHand ?? "0") + " " + product.inventoryUnit.code,
          },
          {
            label: "Selling Price",
            value: product.defaultSellingPrice ? formatPkr(product.defaultSellingPrice) : "—",
          },
          { label: "Inventory Value", value: formatPkr(current?.value ?? "0") },
          { label: "Low Stock Threshold", value: formatQuantity(product.lowStockThreshold) },
        ]}
      />
      <nav className="flex flex-wrap gap-3">
        {["Overview", "Lots", "Stock Movements", "Purchases", "Sales"].map((tab) => (
          <a className="btn-secondary" key={tab} href={"#" + tab.replaceAll(" ", "-")}>
            {tab}
          </a>
        ))}
      </nav>
      <div id="Overview" className="grid gap-6 lg:grid-cols-2">
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
      <section id="Lots" className="space-y-3">
        <h2 className="text-lg font-semibold">Lots</h2>
        <LotsTable items={lots.items} />
        <Link href={"/inventory/lots?productId=" + id}>View all {lots.total} lots</Link>
      </section>
      <section id="Stock-Movements" className="space-y-3">
        <h2 className="text-lg font-semibold">Stock Movements</h2>
        <MovementsTable items={movements.items} />
        <Link href={"/inventory/movements?productId=" + id}>
          View all {movements.total} movements
        </Link>
      </section>
      <section id="Purchases" className="card space-y-3 p-5">
        <h2 className="font-semibold">Recent Purchases</h2>
        {purchases.map((l) => (
          <p key={l.id}>
            <Link href={"/purchases/" + l.purchaseId}>{l.purchase.purchaseNumber}</Link> ·{" "}
            {l.purchase.supplierNameSnapshot} · {formatQuantity(l.quantity)}{" "}
            {product.inventoryUnit.code} · {formatPkr(l.unitCost)}
          </p>
        ))}
        {!purchases.length && <p>No finalized purchases.</p>}
      </section>
      <section id="Sales" className="card space-y-3 p-5">
        <h2 className="font-semibold">Recent Sales</h2>
        {sales.map((l) => (
          <p key={l.id}>
            <Link href={"/sales/" + l.salesInvoiceId}>{l.salesInvoice.invoiceNumber}</Link> ·{" "}
            {l.salesInvoice.customerNameSnapshot} · {formatQuantity(l.quantity)}{" "}
            {product.inventoryUnit.code} · {formatPkr(l.netAmount)}
          </p>
        ))}
        {!sales.length && <p>No finalized sales.</p>}
      </section>
      <Link className="btn-secondary" href="/products">
        Back to products
      </Link>
    </>
  );
}

import { requireUser } from "@/lib/auth/session";
import { normalizePage } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { InventoryLinks, MovementsTable } from "@/modules/inventory/views";
import { listMovements } from "@/modules/inventory/queries";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;
  const page = normalizePage(params.page);
  const result = await listMovements({
    page,
    search: params.search,
    productId: params.productId,
    from: params.from,
    to: params.to,
  });
  return (
    <>
      <PageHeader
        title="Stock Movement History"
        description="Every stock change with its source document. Running balances follow the recorded movement order for each product."
      />
      <InventoryLinks />
      <form className="flex flex-wrap items-end gap-3">
        <label>
          From
          <input className="input" type="date" name="from" defaultValue={params.from} />
        </label>
        <label>
          To
          <input className="input" type="date" name="to" defaultValue={params.to} />
        </label>
        <input
          className="input max-w-sm"
          name="search"
          aria-label="Search products"
          defaultValue={params.search}
          placeholder="Product or SKU"
        />
        {params.productId && <input type="hidden" name="productId" value={params.productId} />}
        <button className="btn-secondary">Search</button>
      </form>
      <MovementsTable items={result.items} />
      <Pagination {...result} page={page} params={params} />
    </>
  );
}

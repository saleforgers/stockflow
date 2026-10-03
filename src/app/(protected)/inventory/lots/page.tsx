import { requireUser } from "@/lib/auth/session";
import { normalizePage } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { InventoryLinks, LotsTable } from "@/modules/inventory/views";
import { listLots } from "@/modules/inventory/queries";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;
  const page = normalizePage(params.page);
  const result = await listLots({
    page,
    search: params.search,
    productId: params.productId,
    available: params.available === "1",
  });
  return (
    <>
      <PageHeader
        title="Inventory Lots"
        description="Trace stock back to the supplier and purchase. Consumed quantity includes sales, returns and adjustments, net of restocking."
      />
      <InventoryLinks />
      <form className="flex flex-wrap gap-3">
        <input
          className="input max-w-sm"
          name="search"
          aria-label="Search lots"
          defaultValue={params.search}
          placeholder="Product, lot number or supplier"
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="available"
            value="1"
            defaultChecked={params.available === "1"}
          />
          Only lots with stock
        </label>
        {params.productId && <input type="hidden" name="productId" value={params.productId} />}
        <button className="btn-secondary">Search</button>
      </form>
      <LotsTable items={result.items} />
      <Pagination {...result} page={page} params={params} />
    </>
  );
}

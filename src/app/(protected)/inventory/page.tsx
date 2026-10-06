import { requireUser } from "@/lib/auth/session";
import { normalizePage } from "@/lib/pagination";
import { formatPkr } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { InventoryLinks, StockTable } from "@/modules/inventory/views";
import { listStock } from "@/modules/inventory/queries";
import { getProductFilterCategories } from "@/modules/products/queries";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;
  const page = normalizePage(params.page);
  const [result, categories] = await Promise.all([
    listStock({
      page,
      search: params.search,
      low: params.low === "1",
      categoryId: params.categoryId,
    }),
    getProductFilterCategories(),
  ]);
  return (
    <>
      <PageHeader
        title={params.low === "1" ? "Low Stock" : "Inventory — Stock Overview"}
        description={`Current value of matching stock: ${formatPkr(result.totalValue)}. Valued from remaining original cost layers.`}
      />
      <InventoryLinks />
      <form className="card flex flex-wrap items-end gap-3 p-4">
        <label>
          Search
          <input
            className="input"
            name="search"
            placeholder="Product name or SKU"
            defaultValue={params.search}
          />
        </label>
        <label>
          Category
          <select className="input" name="categoryId" defaultValue={params.categoryId}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stock
          <select className="input" name="low" defaultValue={params.low}>
            <option value="">All stock</option>
            <option value="1">Low / Out of Stock</option>
          </select>
        </label>
        <button className="btn-primary">Apply Filters</button>
      </form>
      <StockTable items={result.items} />
      <Pagination {...result} page={page} params={params} />
    </>
  );
}

import Link from "next/link";
import { decimal } from "@/lib/decimal/decimal";
import { formatDate, formatPkr, formatQuantity } from "@/lib/format";
import { businessLabel } from "@/lib/labels";
import { lotLabel, stockStatus, type StockRow, type listLots, type listMovements } from "./queries";
export function InventoryLinks() {
  return (
    <div className="flex flex-wrap gap-2">
      {[
        ["Stock Overview", "/inventory"],
        ["Products", "/products"],
        ["Lots", "/inventory/lots"],
        ["Stock Movements", "/inventory/movements"],
        ["Low Stock", "/inventory/low-stock"],
        ["Adjust Stock", "/inventory/adjust"],
      ].map(([label, href]) => (
        <Link className="btn-secondary" key={href} href={href!}>
          {label}
        </Link>
      ))}
    </div>
  );
}
export function StockTable({ items }: { items: StockRow[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {[
              "Product",
              "SKU",
              "Category",
              "On Hand",
              "Average Cost",
              "Selling Price",
              "Inventory Value",
              "Stock Status",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/products/${p.id}`}>{p.name}</Link>
              </td>
              <td>{p.sku}</td>
              <td>{p.category}</td>
              <td>
                {formatQuantity(p.onHand)} {p.unit}
              </td>
              <td>
                {decimal(p.layerQuantity).gt(0)
                  ? formatPkr(decimal(p.value).div(decimal(p.layerQuantity)))
                  : "—"}
              </td>
              <td>{p.price ? formatPkr(p.price) : "—"}</td>
              <td>{formatPkr(p.value)}</td>
              <td>
                <span
                  className={`status-badge ${stockStatus(p.onHand, p.threshold) === "In Stock" ? "status-active" : "status-inactive"}`}
                >
                  {stockStatus(p.onHand, p.threshold)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <p className="p-6 text-slate-500">No matching products.</p>}
    </div>
  );
}
export function LotsTable({ items }: { items: Awaited<ReturnType<typeof listLots>>["items"] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {[
              "Lot Number",
              "Product",
              "Supplier",
              "Purchase Reference",
              "Received Date",
              "Unit Cost",
              "Original Qty",
              "Consumed Qty (net)",
              "Remaining Qty",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((l) => (
            <tr key={l.id}>
              <td>{lotLabel(l)}</td>
              <td>
                <Link href={`/products/${l.productId}`}>{l.product.name}</Link>
              </td>
              <td>{l.purchaseLot?.purchase.supplierNameSnapshot ?? "Opening / Adjusted Stock"}</td>
              <td>
                {l.purchaseLot ? (
                  <Link href={`/purchases/${l.purchaseLot.purchaseId}`}>
                    {l.purchaseLot.purchase.purchaseNumber}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td>{formatDate(l.receivedAt)}</td>
              <td>{formatPkr(l.unitCost)}</td>
              <td>{formatQuantity(l.originalQuantity)}</td>
              <td>
                {formatQuantity(decimal(l.originalQuantity).minus(l.availableQuantity.toString()))}
              </td>
              <td className="font-semibold">{formatQuantity(l.availableQuantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && (
        <p className="p-6 text-slate-500">
          No stock lots found. Finalized purchases create lots automatically.
        </p>
      )}
    </div>
  );
}
export function MovementsTable({
  items,
}: {
  items: Awaited<ReturnType<typeof listMovements>>["items"];
}) {
  return (
    <div className="card overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {[
              "Date",
              "Product",
              "Movement Type",
              "Reference",
              "Supplier / Customer",
              "Lot",
              "Stock In",
              "Stock Out",
              "Running Balance",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id}>
              <td>{formatDate(m.occurredAt)}</td>
              <td>
                <Link href={`/products/${m.productId}`}>{m.product.name}</Link>
              </td>
              <td>
                {businessLabel(m.movementType)}
                {m.reason && <div className="text-xs text-slate-500">{m.reason}</div>}
              </td>
              <td>{m.href ? <Link href={m.href}>{m.reference}</Link> : m.reference}</td>
              <td>{m.party}</td>
              <td>{m.inventoryLot ? lotLabel(m.inventoryLot) : "—"}</td>
              <td>{m.direction === "IN" ? formatQuantity(m.quantity) : "—"}</td>
              <td>{m.direction === "OUT" ? formatQuantity(m.quantity) : "—"}</td>
              <td>{formatQuantity(m.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <p className="p-6 text-slate-500">No stock movements yet.</p>}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatPkr, formatQuantity } from "@/lib/format";
import { getProductHistory } from "@/modules/products/queries";

export default async function ProductHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const result = await getProductHistory(id);
  if (!result) notFound();
  const showCost = user.role === "ADMIN" || user.role === "MANAGER";
  return (
    <>
      <PageHeader
        title={`${result.product.name} — item history`}
        description={`${result.product.sku} · Current stock ${formatQuantity(result.currentStock)} ${result.product.inventoryUnit.code}`}
      />
      <Link className="btn-secondary" href={`/products/${id}`}>
        Back to product
      </Link>
      <section className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Lot / Batch</th>
              <th>Qty in</th>
              <th>Qty out</th>
              <th>Running balance</th>
              {showCost ? <th>Unit cost</th> : null}
              <th>User / reason</th>
            </tr>
          </thead>
          <tbody>
            {result.history.map((movement) => (
              <tr key={movement.id}>
                <td>{formatDate(movement.occurredAt)}</td>
                <td>{movement.movementType.replaceAll("_", " ")}</td>
                <td>{movement.reference}</td>
                <td>{movement.lotNumber}</td>
                <td>
                  {movement.direction === "IN"
                    ? `${formatQuantity(movement.quantity)} ${result.product.inventoryUnit.code}`
                    : "—"}
                </td>
                <td>
                  {movement.direction === "OUT"
                    ? `${formatQuantity(movement.quantity)} ${result.product.inventoryUnit.code}`
                    : "—"}
                </td>
                <td>
                  {formatQuantity(movement.runningQuantity)} {result.product.inventoryUnit.code}
                </td>
                {showCost ? (
                  <td>{movement.unitCostSnapshot ? formatPkr(movement.unitCostSnapshot) : "—"}</td>
                ) : null}
                <td>
                  {movement.createdBy.name}
                  {movement.reason ? ` · ${movement.reason}` : ""}
                </td>
              </tr>
            ))}
            {!result.history.length ? (
              <tr>
                <td colSpan={showCost ? 9 : 8}>No stock movements recorded.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}

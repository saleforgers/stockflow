import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isIdentifier } from "@/lib/validation/identifier";
import { formatDate, formatQuantity, formatPkr } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!isIdentifier(id)) notFound();
  const adjustment = await prisma.stockAdjustment.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } }, lines: { include: { product: true } } },
  });
  if (!adjustment) notFound();
  return (
    <>
      <PageHeader
        title={adjustment.adjustmentNumber}
        description={`${formatDate(adjustment.adjustmentDate)} · ${adjustment.reason} · Recorded by ${adjustment.createdBy.name}`}
      />
      <p className="alert-success">
        Stock adjustment recorded. Inventory history has been updated.
      </p>
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Stock In</th>
              <th>Stock Out</th>
              <th>Original Unit Cost</th>
            </tr>
          </thead>
          <tbody>
            {adjustment.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/products/${l.productId}`}>{l.product.name}</Link>
                </td>
                <td>{l.direction === "IN" ? formatQuantity(l.quantity) : "—"}</td>
                <td>{l.direction === "OUT" ? formatQuantity(l.quantity) : "—"}</td>
                <td>{l.unitCost ? formatPkr(l.unitCost) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>{adjustment.notes}</p>
      <Link className="btn-secondary" href="/inventory/movements">
        View Stock Movements
      </Link>
    </>
  );
}

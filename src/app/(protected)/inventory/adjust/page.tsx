import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { currentBusinessDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { AdjustmentForm } from "@/modules/inventory/adjustment-form";
import Decimal from "decimal.js";
export default async function Page() {
  await requireRole(["ADMIN", "MANAGER"]);
  const [products, stock] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sku: true, inventoryUnit: { select: { code: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.groupBy({
      by: ["productId", "direction"],
      where: { location: { isDefault: true } },
      _sum: { quantity: true },
    }),
  ]);
  return (
    <>
      <PageHeader
        title="Adjust Stock"
        description="Record a physical stock count, loss, damage or opening stock."
      />
      <AdjustmentForm
        date={currentBusinessDate()}
        requestKey={randomUUID()}
        products={products.map((p) => ({
          id: p.id,
          name: `${p.name} · ${p.sku}`,
          unit: p.inventoryUnit.code,
          quantity: stock
            .filter((s) => s.productId === p.id)
            .reduce(
              (sum, s) =>
                s.direction === "IN"
                  ? sum.plus(s._sum.quantity?.toString() ?? "0")
                  : sum.minus(s._sum.quantity?.toString() ?? "0"),
              new Decimal(0),
            )
            .toFixed(),
        }))}
      />
    </>
  );
}

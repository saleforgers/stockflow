import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimal } from "@/lib/decimal/decimal";
import { DEFAULT_PAGE_SIZE, paginationFor } from "@/lib/pagination";
import { isIdentifier } from "@/lib/validation/identifier";
import { dateFilter } from "@/modules/accounts/queries";

export type StockRow = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  onHand: Prisma.Decimal;
  layerQuantity: Prisma.Decimal;
  value: Prisma.Decimal;
  price: Prisma.Decimal | null;
  threshold: Prisma.Decimal;
};
// Movements are stock truth. Layers retain the original costs for valuation.
export const stockCte = Prisma.sql`WITH quantities AS (
 SELECT m."productId", SUM(CASE WHEN m.direction = 'IN' THEN m.quantity ELSE -m.quantity END) AS quantity
 FROM "StockMovement" m JOIN "InventoryLocation" loc ON loc.id = m."locationId" WHERE loc."isDefault" GROUP BY m."productId"
), layers AS (
 SELECT l."productId", SUM(l."availableQuantity") AS quantity, SUM(l."availableQuantity" * l."unitCost") AS value
 FROM "InventoryLot" l JOIN "InventoryLocation" loc ON loc.id = l."locationId" WHERE loc."isDefault" GROUP BY l."productId"
), stock AS (
 SELECT p.id, p.name, p.sku, c.name AS category, u.code AS unit,
 COALESCE(q.quantity,0) AS "onHand", COALESCE(l.quantity,0) AS "layerQuantity", COALESCE(l.value,0) AS value,
 p."defaultSellingPrice" AS price, p."lowStockThreshold" AS threshold
 FROM "Product" p JOIN "Category" c ON c.id=p."categoryId" JOIN "UnitOfMeasure" u ON u.id=p."inventoryUnitId"
 LEFT JOIN quantities q ON q."productId"=p.id LEFT JOIN layers l ON l."productId"=p.id
 WHERE p."isActive" OR COALESCE(q.quantity,0) <> 0
)`;

export async function listStock(input: {
  page: number;
  search?: string;
  low?: boolean;
  productId?: string;
  categoryId?: string;
}) {
  const clauses = [Prisma.sql`true`];
  if (input.search)
    clauses.push(
      Prisma.sql`(s.name ILIKE ${`%${input.search}%`} OR s.sku ILIKE ${`%${input.search}%`})`,
    );
  if (input.low) clauses.push(Prisma.sql`s."onHand" <= s.threshold`);
  if (input.productId && isIdentifier(input.productId))
    clauses.push(Prisma.sql`s.id=${input.productId}::uuid`);
  if (input.categoryId && isIdentifier(input.categoryId))
    clauses.push(
      Prisma.sql`s.id IN (SELECT id FROM "Product" WHERE "categoryId"=${input.categoryId}::uuid)`,
    );
  const where = Prisma.join(clauses, " AND ");
  const { skip, take } = paginationFor(input.page);
  const [items, counts] = await prisma.$transaction(
    [
      prisma.$queryRaw<StockRow[]>(
        Prisma.sql`${stockCte} SELECT s.* FROM stock s WHERE ${where} ORDER BY s.name, s.id LIMIT ${take} OFFSET ${skip}`,
      ),
      prisma.$queryRaw<{ count: bigint; value: Prisma.Decimal }[]>(
        Prisma.sql`${stockCte} SELECT COUNT(*) AS count, COALESCE(SUM(s.value),0) AS value FROM stock s WHERE ${where}`,
      ),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return {
    items,
    total: Number(counts[0]?.count ?? 0),
    totalValue: counts[0]?.value ?? "0",
    pageSize: DEFAULT_PAGE_SIZE,
  };
}
export function stockStatus(quantity: { toString(): string }, threshold: { toString(): string }) {
  return decimal(quantity).lte(0)
    ? "Out of Stock"
    : decimal(quantity).lte(decimal(threshold))
      ? "Low Stock"
      : "In Stock";
}

export async function listLots(input: {
  page: number;
  productId?: string;
  search?: string;
  available?: boolean;
}) {
  const where: Prisma.InventoryLotWhereInput = {
    location: { isDefault: true },
    ...(input.productId && isIdentifier(input.productId) ? { productId: input.productId } : {}),
    ...(input.available ? { availableQuantity: { gt: 0 } } : {}),
    ...(input.search
      ? {
          OR: [
            { product: { name: { contains: input.search, mode: "insensitive" } } },
            { purchaseLot: { lotNumber: { contains: input.search, mode: "insensitive" } } },
            {
              purchaseLot: {
                purchase: { supplierNameSnapshot: { contains: input.search, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.inventoryLot.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        purchaseLot: {
          include: {
            purchase: { select: { id: true, purchaseNumber: true, supplierNameSnapshot: true } },
          },
        },
        adjustmentLines: {
          where: { direction: "IN" },
          include: { stockAdjustment: true },
          take: 1,
        },
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      ...paginationFor(input.page),
    }),
    prisma.inventoryLot.count({ where }),
  ]);
  return { items, total, pageSize: DEFAULT_PAGE_SIZE };
}
export function lotLabel(lot: {
  origin: string;
  receivedAt: Date;
  purchaseLot?: { lotNumber: string } | null;
  adjustmentLines?: { stockAdjustment: { adjustmentNumber: string } }[];
}) {
  return (
    lot.purchaseLot?.lotNumber ??
    lot.adjustmentLines?.[0]?.stockAdjustment.adjustmentNumber ??
    `${lot.origin === "OPENING" ? "Opening Stock" : "Adjusted Stock"} · ${lot.receivedAt.toISOString().slice(0, 10)}`
  );
}

export async function listMovements(input: {
  page: number;
  productId?: string;
  search?: string;
  from?: string;
  to?: string;
}) {
  if (input.productId && !isIdentifier(input.productId)) input = { ...input, productId: undefined };
  const dates = dateFilter(input.from, input.to);
  const where: Prisma.StockMovementWhereInput = {
    ...(dates.start || dates.end
      ? {
          occurredAt: {
            ...(dates.start ? { gte: new Date(dates.start.getTime() - 5 * 60 * 60 * 1000) } : {}),
            ...(dates.end ? { lt: new Date(dates.end.getTime() + 19 * 60 * 60 * 1000) } : {}),
          },
        }
      : {}),
    location: { isDefault: true },
    ...(input.productId ? { productId: input.productId } : {}),
    ...(input.search
      ? {
          product: {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { sku: { contains: input.search, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        inventoryLot: {
          include: {
            purchaseLot: true,
            adjustmentLines: {
              where: { direction: "IN" },
              include: { stockAdjustment: true },
              take: 1,
            },
          },
        },
        purchaseLine: { include: { purchase: true } },
        purchaseReturnLine: { include: { purchaseReturn: { include: { purchase: true } } } },
        saleLotAllocation: { include: { salesInvoiceLine: { include: { salesInvoice: true } } } },
        saleReturnAllocation: {
          include: {
            saleReturnLine: { include: { saleReturn: { include: { salesInvoice: true } } } },
          },
        },
        adjustmentLine: { include: { stockAdjustment: true } },
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      ...paginationFor(input.page),
    }),
    prisma.stockMovement.count({ where }),
  ]);
  // Window before pagination preserves balances for older pages and filtered product histories.
  const ids = items.map((m) => m.id);
  const balances = ids.length
    ? await prisma.$queryRaw<{ id: string; balance: Prisma.Decimal }[]>(Prisma.sql`
    SELECT id, balance FROM (SELECT m.id, SUM(CASE WHEN direction='IN' THEN quantity ELSE -quantity END)
    OVER (PARTITION BY "productId", "locationId" ORDER BY "occurredAt", "createdAt", id ROWS UNBOUNDED PRECEDING) AS balance
    FROM "StockMovement" m WHERE ${input.productId ? Prisma.sql`"productId"=${input.productId}::uuid` : Prisma.sql`true`}) history
    WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})`)
    : [];
  return {
    items: items.map((m) => {
      const purchase = m.purchaseLine?.purchase ?? m.purchaseReturnLine?.purchaseReturn.purchase;
      const sale =
        m.saleLotAllocation?.salesInvoiceLine.salesInvoice ??
        m.saleReturnAllocation?.saleReturnLine.saleReturn.salesInvoice;
      const adjustment = m.adjustmentLine?.stockAdjustment;
      return {
        ...m,
        reference:
          m.purchaseReturnLine?.purchaseReturn.returnNumber ??
          m.saleReturnAllocation?.saleReturnLine.saleReturn.returnNumber ??
          purchase?.purchaseNumber ??
          sale?.invoiceNumber ??
          adjustment?.adjustmentNumber ??
          "Stock change",
        href: purchase
          ? `/purchases/${purchase.id}`
          : sale
            ? `/sales/${sale.id}`
            : adjustment
              ? `/inventory/adjustments/${adjustment.id}`
              : undefined,
        party: purchase?.supplierNameSnapshot ?? sale?.customerNameSnapshot ?? "—",
        balance: balances.find((b) => b.id === m.id)?.balance ?? "0",
      };
    }),
    total,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

import { prisma } from "@/lib/db/prisma";
import Decimal from "decimal.js";
import { DEFAULT_PAGE_SIZE, paginationFor } from "@/lib/pagination";
import { stockStatus } from "@/modules/inventory/queries";
import { isIdentifier } from "@/lib/validation/identifier";

export async function listProducts(input: {
  search?: string;
  active?: boolean;
  categoryId?: string;
  page: number;
}) {
  const where = {
    ...(typeof input.active === "boolean" ? { isActive: input.active } : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.search
      ? {
          OR: [
            { sku: { contains: input.search, mode: "insensitive" as const } },
            { name: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        inventoryUnit: { select: { code: true } },
        preferredSupplier: { select: { name: true } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      ...paginationFor(input.page),
    }),
    prisma.product.count({ where }),
  ]);
  const quantities = items.length
    ? await prisma.stockMovement.groupBy({
        by: ["productId", "direction"],
        where: { productId: { in: items.map((p) => p.id) }, location: { isDefault: true } },
        _sum: { quantity: true },
      })
    : [];
  return {
    items: items.map((p) => {
      const onHand = quantities
        .filter((q) => q.productId === p.id)
        .reduce(
          (s, q) =>
            q.direction === "IN"
              ? s.plus(q._sum.quantity?.toString() ?? "0")
              : s.minus(q._sum.quantity?.toString() ?? "0"),
          new Decimal(0),
        );
      return {
        ...p,
        onHand: onHand.toFixed(),
        stockStatus: stockStatus(onHand, p.lowStockThreshold),
      };
    }),
    total,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

export function getProduct(id: string) {
  if (!isIdentifier(id)) return null;
  return prisma.product.findUnique({
    where: { id },
    include: { category: true, inventoryUnit: true, preferredSupplier: true },
  });
}

export async function getProductCurrentStock(id: string) {
  if (!isIdentifier(id)) return null;
  const quantities = await prisma.stockMovement.groupBy({
    by: ["direction"],
    where: { productId: id, location: { isDefault: true } },
    _sum: { quantity: true },
  });
  return quantities
    .reduce(
      (stock, row) =>
        row.direction === "IN"
          ? stock.plus(row._sum.quantity?.toString() ?? "0")
          : stock.minus(row._sum.quantity?.toString() ?? "0"),
      new Decimal(0),
    )
    .toFixed();
}

export async function getProductHistory(id: string) {
  if (!isIdentifier(id)) return null;
  const [product, movements] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { inventoryUnit: true },
    }),
    prisma.stockMovement.findMany({
      where: { productId: id },
      include: {
        inventoryLot: { include: { purchaseLot: { select: { lotNumber: true } } } },
        createdBy: { select: { name: true } },
        purchaseLine: { include: { purchase: { select: { purchaseNumber: true } } } },
        purchaseReturnLine: { include: { purchaseReturn: { select: { returnNumber: true } } } },
        saleLotAllocation: {
          include: {
            salesInvoiceLine: { include: { salesInvoice: { select: { invoiceNumber: true } } } },
          },
        },
        saleReturnAllocation: {
          include: {
            saleReturnLine: { include: { saleReturn: { select: { returnNumber: true } } } },
          },
        },
        adjustmentLine: { include: { stockAdjustment: { select: { adjustmentNumber: true } } } },
      },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
  ]);
  if (!product) return null;
  let running = new Decimal(0);
  const history = movements.map((movement) => {
    running =
      movement.direction === "IN"
        ? running.plus(movement.quantity.toString())
        : running.minus(movement.quantity.toString());
    return {
      ...movement,
      runningQuantity: running.toFixed(),
      reference:
        movement.purchaseLine?.purchase.purchaseNumber ??
        movement.purchaseReturnLine?.purchaseReturn.returnNumber ??
        movement.saleLotAllocation?.salesInvoiceLine.salesInvoice.invoiceNumber ??
        movement.saleReturnAllocation?.saleReturnLine.saleReturn.returnNumber ??
        movement.adjustmentLine?.stockAdjustment.adjustmentNumber ??
        "—",
      lotNumber: movement.inventoryLot?.purchaseLot?.lotNumber ?? "—",
    };
  });
  return { product, history, currentStock: running.toFixed() };
}

export async function getProductFormOptions() {
  const [categories, units, suppliers] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.unitOfMeasure.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  return { categories, units, suppliers };
}

export function getProductFilterCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

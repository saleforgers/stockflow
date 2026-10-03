import { prisma } from "@/lib/db/prisma";
import { DEFAULT_PAGE_SIZE, paginationFor } from "@/lib/pagination";
import Decimal from "decimal.js";
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

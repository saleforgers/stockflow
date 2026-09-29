import { prisma } from "@/lib/db/prisma";
import { DEFAULT_PAGE_SIZE, paginationFor } from "@/lib/pagination";

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
  return { items, total, pageSize: DEFAULT_PAGE_SIZE };
}

export function getProduct(id: string) {
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

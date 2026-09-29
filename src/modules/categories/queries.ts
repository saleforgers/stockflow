import { prisma } from "@/lib/db/prisma";
import { DEFAULT_PAGE_SIZE, paginationFor } from "@/lib/pagination";

export async function listCategories(input: { search?: string; active?: boolean; page: number }) {
  const where = {
    ...(typeof input.active === "boolean" ? { isActive: input.active } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { slug: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.category.findMany({
      where,
      include: { parent: { select: { name: true } }, _count: { select: { products: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      ...paginationFor(input.page),
    }),
    prisma.category.count({ where }),
  ]);
  return { items, total, pageSize: DEFAULT_PAGE_SIZE };
}

export function getCategory(id: string) {
  return prisma.category.findUnique({ where: { id } });
}

export function getCategoryOptions(excludeId?: string) {
  return prisma.category.findMany({
    where: { isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

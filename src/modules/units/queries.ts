import { prisma } from "@/lib/db/prisma";
import { DEFAULT_PAGE_SIZE, paginationFor } from "@/lib/pagination";

export async function listUnits(input: { search?: string; active?: boolean; page: number }) {
  const where = {
    ...(typeof input.active === "boolean" ? { isActive: input.active } : {}),
    ...(input.search
      ? {
          OR: [
            { code: { contains: input.search, mode: "insensitive" as const } },
            { name: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.unitOfMeasure.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: [{ code: "asc" }, { id: "asc" }],
      ...paginationFor(input.page),
    }),
    prisma.unitOfMeasure.count({ where }),
  ]);
  return { items, total, pageSize: DEFAULT_PAGE_SIZE };
}

export function getUnit(id: string) {
  return prisma.unitOfMeasure.findUnique({ where: { id } });
}

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_PAGE_SIZE, paginationFor } from "@/lib/pagination";

export async function listSuppliers(input: { search?: string; active?: boolean; page: number }) {
  const where = {
    ...(typeof input.active === "boolean" ? { isActive: input.active } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { contactPerson: { contains: input.search, mode: "insensitive" as const } },
            { phone: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.supplier.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      ...paginationFor(input.page),
    }),
    prisma.supplier.count({ where }),
  ]);
  return { items, total, pageSize: DEFAULT_PAGE_SIZE };
}

export function getSupplier(id: string) {
  return prisma.supplier.findUnique({ where: { id } });
}

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_PAGE_SIZE, paginationFor } from "@/lib/pagination";

export async function listCustomers(input: { search?: string; active?: boolean; page: number }) {
  const where = {
    ...(typeof input.active === "boolean" ? { isActive: input.active } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { phone: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      orderBy: [{ isWalkIn: "desc" }, { name: "asc" }],
      ...paginationFor(input.page),
    }),
    prisma.customer.count({ where }),
  ]);
  return { items, total, pageSize: DEFAULT_PAGE_SIZE };
}

export function getCustomer(id: string) {
  return prisma.customer.findUnique({ where: { id } });
}

import { prisma } from "@/lib/db/prisma";
import { isIdentifier } from "@/lib/validation/identifier";
import { DEFAULT_PAGE_SIZE, paginationFor } from "@/lib/pagination";
export async function listEstimates(page: number, search = "") {
  const where = search
    ? {
        OR: [
          { estimateNumber: { contains: search, mode: "insensitive" as const } },
          { customerNameSnapshot: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [items, total] = await prisma.$transaction([
    prisma.estimate.findMany({
      where,
      orderBy: [{ estimateDate: "desc" }, { id: "desc" }],
      ...paginationFor(page),
    }),
    prisma.estimate.count({ where }),
  ]);
  return { items, total, pageSize: DEFAULT_PAGE_SIZE };
}
export function getEstimate(id: string) {
  return isIdentifier(id)
    ? prisma.estimate.findUnique({
        where: { id },
        include: { convertedInvoice: { select: { id: true, invoiceNumber: true } } },
      })
    : null;
}

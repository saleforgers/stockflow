import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { decimal } from "@/lib/decimal/decimal";
import { isIdentifier } from "@/lib/validation/identifier";
import { paginationFor, DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export async function listInvoices(search: string, page: number) {
  const where = search
    ? {
        OR: [
          { invoiceNumber: { contains: search, mode: "insensitive" as const } },
          { customerNameSnapshot: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [items, total] = await prisma.$transaction([
    prisma.salesInvoice.findMany({
      where,
      orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
      ...paginationFor(page),
    }),
    prisma.salesInvoice.count({ where }),
  ]);
  return { items, total, pageSize: DEFAULT_PAGE_SIZE };
}
export function getInvoice(id: string) {
  if (!isIdentifier(id)) return null;
  return prisma.salesInvoice.findUnique({
    where: { id },
    include: {
      customer: true,
      lines: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          lotAllocations: { include: { inventoryLot: { include: { purchaseLot: true } } } },
          returnLines: {
            where: { saleReturn: { status: "POSTED" } },
            include: { allocations: true },
          },
        },
      },
      paymentAllocations: { where: { payment: { status: "POSTED" } }, include: { payment: true } },
      returns: {
        where: { status: "POSTED" },
        include: { lines: { include: { allocations: true } } },
      },
    },
  });
}
export async function getSalesOptions() {
  const [customers, products, paymentMethods, invoices] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true, isWalkIn: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { isActive: true, inventoryUnit: { isActive: true } },
      select: {
        id: true,
        name: true,
        sku: true,
        defaultSellingPrice: true,
        inventoryUnit: { select: { code: true, decimalScale: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.paymentMethod.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.salesInvoice.findMany({
      where: { status: "POSTED" },
      select: {
        id: true,
        customerId: true,
        invoiceNumber: true,
        totalAmount: true,
        paymentAllocations: { where: { payment: { status: "POSTED" } }, select: { amount: true } },
        returns: { where: { status: "POSTED" }, select: { totalAmount: true } },
      },
      orderBy: [{ invoiceDate: "asc" }, { id: "asc" }],
    }),
  ]);
  return {
    customers,
    paymentMethods,
    products: products.map((p) => ({
      ...p,
      defaultSellingPrice: p.defaultSellingPrice?.toFixed(4) ?? "",
    })),
    invoices: invoices
      .map((i) => ({
        id: i.id,
        customerId: i.customerId,
        invoiceNumber: i.invoiceNumber,
        outstanding: Decimal.max(
          decimal(i.totalAmount).minus(
            [
              ...i.paymentAllocations.map((a) => a.amount),
              ...i.returns.map((r) => r.totalAmount),
            ].reduce((s, a) => s.plus(a.toString()), new Decimal(0)),
          ),
          0,
        ).toFixed(2),
      }))
      .filter((i) => decimal(i.outstanding).gt(0)),
  };
}
export async function getCustomerAccount(customerId: string) {
  if (!isIdentifier(customerId)) return null;
  const [customer, entries, payments] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.customerLedgerEntry.findMany({
      where: { customerId },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.payment.findMany({
      where: { customerId, kind: "CUSTOMER_RECEIPT", status: "POSTED" },
      include: {
        paymentMethod: true,
        customerAllocations: { include: { salesInvoice: { select: { invoiceNumber: true } } } },
      },
      orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
    }),
  ]);
  let balance = new Decimal(0);
  const statement = entries.map((e) => {
    balance =
      e.effect === "INCREASE"
        ? balance.plus(e.amount.toString())
        : balance.minus(e.amount.toString());
    return { ...e, runningBalance: balance.toFixed(2) };
  });
  return {
    customer,
    statement,
    receivable: balance.toFixed(2),
    payments: payments.map((p) => ({
      ...p,
      unallocated: decimal(p.amount)
        .minus(p.customerAllocations.reduce((s, a) => s.plus(a.amount.toString()), new Decimal(0)))
        .toFixed(2),
    })),
  };
}

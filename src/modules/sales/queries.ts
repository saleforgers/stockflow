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
          lotAllocations: {
            include: {
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
            },
          },
          returnLines: {
            where: { saleReturn: { status: "POSTED" } },
            include: { allocations: true },
          },
        },
      },
      paymentAllocations: {
        where: { payment: { status: "POSTED" } },
        include: { payment: { include: { paymentMethod: true } } },
      },
      returns: {
        where: { status: "POSTED" },
        include: { lines: { include: { allocations: true } } },
      },
    },
  });
}
export async function getSalesOptions(withInvoices = true) {
  const [customers, products, paymentMethods, invoices, stock] = await Promise.all([
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
    withInvoices
      ? prisma.salesInvoice.findMany({
          where: { status: "POSTED" },
          select: {
            id: true,
            customerId: true,
            invoiceNumber: true,
            totalAmount: true,
            paymentAllocations: {
              where: { payment: { status: "POSTED" } },
              select: { amount: true },
            },
            returns: { where: { status: "POSTED" }, select: { totalAmount: true } },
          },
          orderBy: [{ invoiceDate: "asc" }, { id: "asc" }],
        })
      : Promise.resolve([]),
    // Form catalogue is already fetched in one query. Stock lookup remains server-side.
    prisma.stockMovement.groupBy({
      by: ["productId", "direction"],
      where: { location: { isDefault: true } },
      _sum: { quantity: true },
    }),
  ]);

  const balanceByCustomer = new Map<string, Decimal>();
  if (customers.length > 0) {
    const customerLedgerEntries = await prisma.customerLedgerEntry.findMany({
      where: {
        customerId: { in: customers.map((customer) => customer.id) },
      },
      select: { customerId: true, effect: true, amount: true },
    });

    for (const entry of customerLedgerEntries) {
      const balance = balanceByCustomer.get(entry.customerId) ?? new Decimal(0);
      balanceByCustomer.set(
        entry.customerId,
        entry.effect === "INCREASE" ? balance.plus(entry.amount.toString()) : balance.minus(entry.amount.toString()),
      );
    }
  }

  return {
    customers: customers.map((customer) => ({
      ...customer,
      accountBalance: (balanceByCustomer.get(customer.id) ?? new Decimal(0)).toFixed(2),
    })),
    paymentMethods,
    products: products.map((p) => ({
      ...p,
      defaultSellingPrice: p.defaultSellingPrice?.toFixed(4) ?? "",
      available: stock
        .filter((s) => s.productId === p.id)
        .reduce(
          (sum, s) =>
            s.direction === "IN"
              ? sum.plus(s._sum.quantity?.toString() ?? "0")
              : sum.minus(s._sum.quantity?.toString() ?? "0"),
          new Decimal(0),
        )
        .toFixed(),
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
    summary: {
      openingBalance: "0.00",
      totalSales: entries
        .filter((entry) => entry.entryType === "SALE")
        .reduce((sum, entry) => sum.plus(entry.amount.toString()), new Decimal(0))
        .toFixed(2),
      totalReceived: entries
        .filter((entry) => entry.entryType === "PAYMENT")
        .reduce((sum, entry) => sum.plus(entry.amount.toString()), new Decimal(0))
        .toFixed(2),
      outstanding: Decimal.max(balance, 0).toFixed(2),
      creditBalance: Decimal.max(balance.negated(), 0).toFixed(2),
    },
    payments: payments.map((p) => ({
      ...p,
      unallocated: decimal(p.amount)
        .minus(p.customerAllocations.reduce((s, a) => s.plus(a.amount.toString()), new Decimal(0)))
        .toFixed(2),
    })),
  };
}

export async function getInvoiceAccountSummary(id: string) {
  if (!isIdentifier(id)) return null;
  const invoice = await prisma.salesInvoice.findUnique({
    where: { id },
    select: {
      customerId: true,
      status: true,
      ledgerEntry: { select: { id: true } },
    },
  });
  if (!invoice) return null;
  const entries = await prisma.customerLedgerEntry.findMany({
    where: { customerId: invoice.customerId },
    select: { id: true, effect: true, amount: true },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  let previous = new Decimal(0);
  let current = new Decimal(0);
  let reachedInvoice = invoice.status !== "POSTED";
  for (const entry of entries) {
    if (entry.id === invoice.ledgerEntry?.id) reachedInvoice = true;
    const amount = decimal(entry.amount);
    current = entry.effect === "INCREASE" ? current.plus(amount) : current.minus(amount);
    if (!reachedInvoice)
      previous = entry.effect === "INCREASE" ? previous.plus(amount) : previous.minus(amount);
  }
  if (invoice.status !== "POSTED") previous = current;
  return { previousBalance: previous.toFixed(2), currentOutstanding: current.toFixed(2) };
}

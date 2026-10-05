import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_PAGE_SIZE, paginationFor } from "@/lib/pagination";
import { decimal } from "@/lib/decimal/decimal";
import { isIdentifier } from "@/lib/validation/identifier";

export async function listPurchases(input: {
  search?: string;
  status?: "DRAFT" | "POSTED" | "VOID";
  supplierId?: string;
  page: number;
}) {
  const where = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.supplierId ? { supplierId: input.supplierId } : {}),
    ...(input.search
      ? {
          OR: [
            { purchaseNumber: { contains: input.search, mode: "insensitive" as const } },
            { supplierNameSnapshot: { contains: input.search, mode: "insensitive" as const } },
            { supplierInvoiceRef: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.purchase.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        paymentAllocations: {
          where: { payment: { status: "POSTED" } },
          select: { amount: true },
        },
        returns: { where: { status: "POSTED" }, select: { totalAmount: true } },
      },
      orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      ...paginationFor(input.page),
    }),
    prisma.purchase.count({ where }),
  ]);
  return {
    items: items.map((item) => {
      const settled = [
        ...item.paymentAllocations.map((row) => row.amount),
        ...item.returns.map((row) => row.totalAmount),
      ].reduce((sum, value) => sum.plus(value.toString()), new Decimal(0));
      return {
        ...item,
        outstanding: Decimal.max(decimal(item.totalAmount).minus(settled), 0).toFixed(2),
      };
    }),
    total,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

export function getPurchase(id: string) {
  if (!isIdentifier(id)) return null;
  return prisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      location: true,
      createdBy: { select: { name: true } },
      lots: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          lines: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            include: {
              product: { include: { inventoryUnit: true } },
              inventoryLot: true,
              purchaseReturnLines: {
                where: { purchaseReturn: { status: "POSTED" } },
                select: {
                  quantity: true,
                  lineTotal: true,
                  purchaseReturn: { select: { returnNumber: true } },
                },
              },
            },
          },
        },
      },
      paymentAllocations: {
        where: { payment: { status: "POSTED" } },
        include: { payment: { include: { paymentMethod: true } } },
        orderBy: { createdAt: "asc" },
      },
      returns: { where: { status: "POSTED" }, orderBy: [{ returnDate: "asc" }, { id: "asc" }] },
      ledgerEntry: true,
    },
  });
}

export async function getPurchaseFormOptions() {
  const [suppliers, products, supplierBalances, stock] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { isActive: true, inventoryUnit: { isActive: true } },
      select: {
        id: true,
        sku: true,
        name: true,
        defaultPurchasePrice: true,
        defaultSellingPrice: true,
        inventoryUnit: { select: { code: true, decimalScale: true } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.supplierLedgerEntry.groupBy({
      by: ["supplierId", "effect"],
      _sum: { amount: true },
    }),
    prisma.stockMovement.groupBy({
      by: ["productId", "direction"],
      _sum: { quantity: true },
    }),
  ]);
  const balanceBySupplier = new Map<string, Decimal>();
  for (const row of supplierBalances) {
    const current = balanceBySupplier.get(row.supplierId) ?? new Decimal(0);
    const amount = decimal(row._sum.amount ?? 0);
    balanceBySupplier.set(
      row.supplierId,
      row.effect === "INCREASE" ? current.plus(amount) : current.minus(amount),
    );
  }
  const stockByProduct = new Map<string, Decimal>();
  for (const row of stock) {
    const current = stockByProduct.get(row.productId) ?? new Decimal(0);
    const quantity = decimal(row._sum.quantity ?? 0);
    stockByProduct.set(
      row.productId,
      row.direction === "IN" ? current.plus(quantity) : current.minus(quantity),
    );
  }
  return {
    suppliers: suppliers.map((supplier) => ({
      ...supplier,
      accountBalance: (balanceBySupplier.get(supplier.id) ?? new Decimal(0)).toFixed(2),
    })),
    products: products.map((product) => ({
      ...product,
      defaultPurchasePrice: product.defaultPurchasePrice?.toFixed(4) ?? "",
      defaultSellingPrice: product.defaultSellingPrice?.toFixed(4) ?? "",
      currentStock: (stockByProduct.get(product.id) ?? new Decimal(0)).toFixed(),
    })),
  };
}

export function getActivePurchasePaymentMethods() {
  return prisma.paymentMethod.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getSupplierPaymentOptions() {
  const [suppliers, paymentMethods, purchases] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.paymentMethod.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.purchase.findMany({
      where: { status: "POSTED", paymentStatus: { not: "PAID" } },
      select: {
        id: true,
        purchaseNumber: true,
        supplierId: true,
        purchaseDate: true,
        totalAmount: true,
        paymentAllocations: { where: { payment: { status: "POSTED" } }, select: { amount: true } },
        returns: { where: { status: "POSTED" }, select: { totalAmount: true } },
      },
      orderBy: [{ purchaseDate: "asc" }, { id: "asc" }],
    }),
  ]);
  return {
    suppliers,
    paymentMethods,
    purchases: purchases
      .map((purchase) => {
        const settled = [
          ...purchase.paymentAllocations.map((row) => row.amount),
          ...purchase.returns.map((row) => row.totalAmount),
        ].reduce((sum, value) => sum.plus(value.toString()), new Decimal(0));
        return {
          id: purchase.id,
          purchaseNumber: purchase.purchaseNumber,
          supplierId: purchase.supplierId,
          purchaseDate: purchase.purchaseDate.toISOString().slice(0, 10),
          outstanding: Decimal.max(decimal(purchase.totalAmount).minus(settled), 0).toFixed(2),
        };
      })
      .filter((purchase) => !decimal(purchase.outstanding).isZero()),
  };
}

export async function getSupplierAccount(supplierId: string) {
  if (!isIdentifier(supplierId)) {
    return {
      supplier: null,
      statement: [],
      payments: [],
      purchases: [],
      payable: "0.00",
      unallocated: "0.00",
      summary: {
        openingBalance: "0.00",
        totalPurchases: "0.00",
        totalPaid: "0.00",
        payableBalance: "0.00",
        advanceBalance: "0.00",
      },
    };
  }
  const [supplier, entries, payments, purchases] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: supplierId } }),
    prisma.supplierLedgerEntry.findMany({
      where: { supplierId },
      include: {
        purchase: { select: { purchaseNumber: true } },
        payment: { select: { paymentNumber: true } },
        purchaseReturn: { select: { returnNumber: true } },
      },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.payment.findMany({
      where: { supplierId, status: "POSTED", kind: "SUPPLIER_PAYMENT" },
      include: { paymentMethod: true, supplierAllocations: { select: { amount: true } } },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    }),
    prisma.purchase.findMany({
      where: { supplierId, status: "POSTED" },
      select: {
        id: true,
        purchaseNumber: true,
        purchaseDate: true,
        totalAmount: true,
        paymentStatus: true,
      },
      orderBy: [{ purchaseDate: "desc" }, { id: "desc" }],
    }),
  ]);
  let running = new Decimal(0);
  const statement = entries.map((entry) => {
    running =
      entry.effect === "INCREASE"
        ? running.plus(entry.amount.toString())
        : running.minus(entry.amount.toString());
    return { ...entry, runningBalance: running.toFixed(2) };
  });
  const paymentRows = payments.map((payment) => {
    const allocated = payment.supplierAllocations.reduce(
      (sum, row) => sum.plus(row.amount.toString()),
      new Decimal(0),
    );
    return { ...payment, unallocated: decimal(payment.amount).minus(allocated).toFixed(2) };
  });
  const unallocated = paymentRows.reduce(
    (sum, payment) => sum.plus(payment.unallocated),
    new Decimal(0),
  );
  return {
    supplier,
    statement,
    payments: paymentRows,
    purchases,
    payable: running.toFixed(2),
    unallocated: unallocated.toFixed(2),
    summary: {
      openingBalance: "0.00",
      totalPurchases: entries
        .filter((entry) => entry.entryType === "PURCHASE")
        .reduce((sum, entry) => sum.plus(entry.amount.toString()), new Decimal(0))
        .toFixed(2),
      totalPaid: entries
        .filter((entry) => entry.entryType === "PAYMENT")
        .reduce((sum, entry) => sum.plus(entry.amount.toString()), new Decimal(0))
        .toFixed(2),
      payableBalance: Decimal.max(running, 0).toFixed(2),
      advanceBalance: Decimal.max(running.negated(), 0).toFixed(2),
    },
  };
}

export function getSupplierFilterOptions() {
  return prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

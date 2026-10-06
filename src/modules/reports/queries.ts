import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { profitTotals } from "./calculations";
import { dateFilter } from "@/modules/accounts/queries";
import { DEFAULT_PAGE_SIZE, paginationFor } from "@/lib/pagination";
import { isIdentifier } from "@/lib/validation/identifier";
export async function profitAndLoss(from?: string, to?: string) {
  const { start, end } = dateFilter(from, to);
  const range = (column: Prisma.Sql) =>
    Prisma.sql`${start ? Prisma.sql`${column}>=${start}::date` : Prisma.sql`true`} AND ${end ? Prisma.sql`${column}<=${end}::date` : Prisma.sql`true`}`;
  const [row] = await prisma.$queryRaw<
    {
      sales: Prisma.Decimal;
      returns: Prisma.Decimal;
      cost: Prisma.Decimal;
      returnedCost: Prisma.Decimal;
      expenses: Prisma.Decimal;
      stockReductions: Prisma.Decimal;
    }[]
  >(Prisma.sql`SELECT
 (SELECT COALESCE(SUM("totalAmount"),0) FROM "SalesInvoice" WHERE status='POSTED' AND ${range(Prisma.sql`"invoiceDate"`)}) AS sales,
 (SELECT COALESCE(SUM("totalAmount"),0) FROM "SaleReturn" WHERE status='POSTED' AND ${range(Prisma.sql`"returnDate"`)}) AS returns,
 (SELECT COALESCE(SUM(a.quantity*a."unitCostSnapshot"),0) FROM "SaleLotAllocation" a JOIN "SalesInvoiceLine" l ON l.id=a."salesInvoiceLineId" JOIN "SalesInvoice" i ON i.id=l."salesInvoiceId" WHERE i.status='POSTED' AND ${range(Prisma.sql`i."invoiceDate"`)}) AS cost,
 (SELECT COALESCE(SUM(a.quantity*a."unitCostSnapshot"),0) FROM "SaleReturnAllocation" a JOIN "SaleReturnLine" l ON l.id=a."saleReturnLineId" JOIN "SaleReturn" r ON r.id=l."saleReturnId" WHERE r.status='POSTED' AND ${range(Prisma.sql`r."returnDate"`)}) AS "returnedCost",
 (SELECT COALESCE(SUM(amount),0) FROM "Expense" WHERE status='POSTED' AND ${range(Prisma.sql`"expenseDate"`)}) AS expenses,
 (SELECT COALESCE(SUM(l.quantity*l."unitCost"),0) FROM "StockAdjustmentLine" l JOIN "StockAdjustment" a ON a.id=l."stockAdjustmentId" WHERE a.status='POSTED' AND l.direction='OUT' AND ${range(Prisma.sql`a."adjustmentDate"`)}) AS "stockReductions"`);
  return {
    ...profitTotals(row!),
    sales: row!.sales,
    returns: row!.returns,
    stockReductions: row!.stockReductions,
  };
}
export async function partyBalances(kind: "customer" | "supplier", page = 1, search = "") {
  const customer = kind === "customer";
  const table = Prisma.raw(customer ? '"CustomerLedgerEntry"' : '"SupplierLedgerEntry"');
  const party = Prisma.raw(customer ? '"Customer"' : '"Supplier"');
  const column = Prisma.raw(customer ? '"customerId"' : '"supplierId"');
  const { skip, take } = paginationFor(page);
  const cte = Prisma.sql`WITH balances AS (SELECT p.id,p.name,p.phone,COALESCE(SUM(CASE WHEN l.effect='INCREASE' THEN l.amount ELSE -l.amount END),0) AS balance FROM ${party} p LEFT JOIN ${table} l ON l.${column}=p.id GROUP BY p.id), matching AS (SELECT * FROM balances WHERE name ILIKE ${`%${search}%`} AND balance<>0)`;
  const [items, summary] = await prisma.$transaction(
    [
      prisma.$queryRaw<
        { id: string; name: string; phone: string | null; balance: Prisma.Decimal }[]
      >(
        Prisma.sql`${cte} SELECT * FROM matching ORDER BY balance DESC,name,id LIMIT ${take} OFFSET ${skip}`,
      ),
      prisma.$queryRaw<{ count: bigint; outstanding: Prisma.Decimal; credit: Prisma.Decimal }[]>(
        Prisma.sql`${cte} SELECT COUNT(*) AS count,COALESCE(SUM(GREATEST(balance,0)),0) AS outstanding,COALESCE(SUM(GREATEST(-balance,0)),0) AS credit FROM matching`,
      ),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return {
    items,
    total: Number(summary[0]?.count ?? 0),
    outstanding: summary[0]?.outstanding ?? "0",
    credit: summary[0]?.credit ?? "0",
    pageSize: DEFAULT_PAGE_SIZE,
  };
}
export async function documentReport(
  kind: "sales" | "purchases",
  input: {
    page: number;
    from?: string;
    to?: string;
    partyId?: string;
    productId?: string;
    search?: string;
  },
) {
  const dates = dateFilter(input.from, input.to);
  const partyId = input.partyId && isIdentifier(input.partyId) ? input.partyId : undefined;
  const productId = input.productId && isIdentifier(input.productId) ? input.productId : undefined;
  if (kind === "sales") {
    const where: Prisma.SalesInvoiceWhereInput = {
      status: "POSTED",
      ...(dates.range ? { invoiceDate: dates.range } : {}),
      ...(partyId ? { customerId: partyId } : {}),
      ...(productId ? { lines: { some: { productId } } } : {}),
      ...(input.search
        ? {
            OR: [
              { invoiceNumber: { contains: input.search, mode: "insensitive" } },
              { customerNameSnapshot: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total, summary] = await prisma.$transaction([
      prisma.salesInvoice.findMany({
        where,
        orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
        ...paginationFor(input.page),
      }),
      prisma.salesInvoice.count({ where }),
      prisma.salesInvoice.aggregate({ where, _sum: { totalAmount: true } }),
    ]);
    return {
      items: items.map((i) => ({
        id: i.id,
        number: i.invoiceNumber,
        date: i.invoiceDate,
        party: i.customerNameSnapshot,
        amount: i.totalAmount,
      })),
      total,
      amount: summary._sum.totalAmount ?? "0",
      pageSize: DEFAULT_PAGE_SIZE,
    };
  }
  const where: Prisma.PurchaseWhereInput = {
    status: "POSTED",
    ...(dates.range ? { purchaseDate: dates.range } : {}),
    ...(partyId ? { supplierId: partyId } : {}),
    ...(productId ? { lines: { some: { productId } } } : {}),
    ...(input.search
      ? {
          OR: [
            { purchaseNumber: { contains: input.search, mode: "insensitive" } },
            { supplierNameSnapshot: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [items, total, summary] = await prisma.$transaction([
    prisma.purchase.findMany({
      where,
      orderBy: [{ purchaseDate: "desc" }, { id: "desc" }],
      ...paginationFor(input.page),
    }),
    prisma.purchase.count({ where }),
    prisma.purchase.aggregate({ where, _sum: { totalAmount: true } }),
  ]);
  return {
    items: items.map((i) => ({
      id: i.id,
      number: i.purchaseNumber,
      date: i.purchaseDate,
      party: i.supplierNameSnapshot,
      amount: i.totalAmount,
    })),
    total,
    amount: summary._sum.totalAmount ?? "0",
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

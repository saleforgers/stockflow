import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isIdentifier } from "@/lib/validation/identifier";
import { DEFAULT_PAGE_SIZE, paginationFor } from "@/lib/pagination";
import { parseBusinessDate } from "@/lib/validation/business-date";
import Decimal from "decimal.js";
export function dateFilter(from?: string, to?: string) {
  const valid = (v?: string) => {
    try {
      return v ? parseBusinessDate(v, "Date") : undefined;
    } catch {
      return undefined;
    }
  };
  const start = valid(from),
    end = valid(to);
  return {
    start,
    end,
    ...(start || end
      ? { range: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } }
      : {}),
  };
}
export type StatementRow = {
  id: string;
  entryDate: Date;
  createdAt: Date;
  reference: string | null;
  entryType: string;
  reason: string | null;
  effect: string;
  amount: Prisma.Decimal;
  balance: Prisma.Decimal;
  documentId: string | null;
};
export async function getStatement(
  kind: "customer" | "supplier",
  id: string,
  input: { page: number; from?: string; to?: string; export?: boolean },
) {
  if (!isIdentifier(id)) return null;
  const customer = kind === "customer";
  const table = Prisma.raw(customer ? '"CustomerLedgerEntry"' : '"SupplierLedgerEntry"');
  const partyColumn = Prisma.raw(customer ? '"customerId"' : '"supplierId"');
  const documentColumn = Prisma.raw(customer ? '"salesInvoiceId"' : '"purchaseId"');
  const { start, end } = dateFilter(input.from, input.to);
  const { skip, take } = paginationFor(input.page);
  const condition = Prisma.sql`${partyColumn}=${id}::uuid`;
  const filtered = Prisma.sql`${start ? Prisma.sql`"entryDate">=${start}::date` : Prisma.sql`true`} AND ${end ? Prisma.sql`"entryDate"<=${end}::date` : Prisma.sql`true`}`;
  const [party, rows, groups, count, bounds] = await Promise.all([
    customer
      ? prisma.customer.findUnique({ where: { id } })
      : prisma.supplier.findUnique({ where: { id } }),
    prisma.$queryRaw<StatementRow[]>(
      Prisma.sql`WITH statement AS (SELECT id,"entryDate","createdAt",reference,"entryType",reason,effect,amount,${documentColumn} AS "documentId",SUM(CASE WHEN effect='INCREASE' THEN amount ELSE -amount END) OVER(ORDER BY "entryDate","createdAt",id ROWS UNBOUNDED PRECEDING) AS balance FROM ${table} WHERE ${condition}) SELECT * FROM statement WHERE ${filtered} ORDER BY "entryDate","createdAt",id ${input.export ? Prisma.sql`LIMIT 10001` : Prisma.sql`LIMIT ${take} OFFSET ${skip}`}`,
    ),
    prisma.$queryRaw<{ entryType: string; amount: Prisma.Decimal; balance: Prisma.Decimal }[]>(
      Prisma.sql`SELECT "entryType",SUM(amount) AS amount,SUM(CASE WHEN effect='INCREASE' THEN amount ELSE -amount END) AS balance FROM ${table} WHERE ${condition} GROUP BY "entryType"`,
    ),
    prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT COUNT(*) AS count FROM ${table} WHERE ${condition} AND ${filtered}`,
    ),
    prisma.$queryRaw<{ opening: Prisma.Decimal; closing: Prisma.Decimal }[]>(
      Prisma.sql`SELECT COALESCE(SUM(CASE WHEN ${start ? Prisma.sql`"entryDate"<${start}::date` : Prisma.sql`false`} THEN CASE WHEN effect='INCREASE' THEN amount ELSE -amount END ELSE 0 END),0) AS opening,COALESCE(SUM(CASE WHEN ${end ? Prisma.sql`"entryDate"<=${end}::date` : Prisma.sql`true`} THEN CASE WHEN effect='INCREASE' THEN amount ELSE -amount END ELSE 0 END),0) AS closing FROM ${table} WHERE ${condition}`,
    ),
  ]);
  if (!party) return null;
  const balance = groups.reduce((s, g) => s.plus(g.balance.toString()), new Decimal(0));
  return {
    party,
    rows,
    total: Number(count[0]?.count ?? 0),
    pageSize: DEFAULT_PAGE_SIZE,
    opening: bounds[0]?.opening ?? "0",
    closing: bounds[0]?.closing ?? "0",
    balance: balance.toFixed(2),
    outstanding: Decimal.max(balance, 0).toFixed(2),
    credit: Decimal.max(balance.negated(), 0).toFixed(2),
    transactions:
      groups.find((g) => g.entryType === (customer ? "SALE" : "PURCHASE"))?.amount ?? "0",
    payments: groups.find((g) => g.entryType === "PAYMENT")?.amount ?? "0",
  };
}

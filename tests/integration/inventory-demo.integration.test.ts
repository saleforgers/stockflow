import "dotenv/config";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { prisma as db } from "../../src/lib/db/prisma";
import type { AuthorizedUser } from "../../src/lib/auth/authorization";
import { seedFoundationData } from "../../prisma/seed-data";
import { adjustStock } from "../../src/modules/inventory/services";
import { listStock, listMovements } from "../../src/modules/inventory/queries";
import { createInvoiceDraft, postInvoice, postSaleReturn } from "../../src/modules/sales/services";
import { getStatement } from "../../src/modules/accounts/queries";
import { profitAndLoss } from "../../src/modules/reports/queries";
import { createExpense, voidExpense } from "../../src/modules/expenses/services";
import { saveEstimate, convertEstimate } from "../../src/modules/estimates/services";
if (process.env.STOCKFLOW_DATABASE_TARGET !== "development-disposable")
  throw new Error("Requires confirmed disposable development database");
let actor: AuthorizedUser,
  productId: string,
  customerId: string,
  cash: string,
  expenseCategoryId: string;
const date = "2036-01-17";
const command = (
  currentQuantity: string,
  actualQuantity: string,
  reason: "Opening Stock" | "Count Correction" = "Count Correction",
  unitCost = "10",
) => ({
  requestKey: randomUUID(),
  productId,
  currentQuantity,
  actualQuantity,
  reason,
  unitCost,
  date,
  notes: "Demo acceptance fixture",
});
describe("client demo inventory and reporting acceptance", () => {
  beforeAll(async () => {
    await seedFoundationData(db);
    const user = await db.user.create({
      data: { name: "Demo acceptance", email: `${randomUUID()}@example.test`, role: "ADMIN" },
    });
    actor = user;
    const unit = await db.unitOfMeasure.findUniqueOrThrow({ where: { code: "PCS" } });
    const category = await db.category.create({
      data: { name: "Demo acceptance", slug: randomUUID() },
    });
    productId = (
      await db.product.create({
        data: {
          name: "Demo acceptance",
          sku: randomUUID(),
          categoryId: category.id,
          inventoryUnitId: unit.id,
          lowStockThreshold: "3",
        },
      })
    ).id;
    customerId = (await db.customer.create({ data: { name: "Demo acceptance" } })).id;
    cash = (await db.paymentMethod.findUniqueOrThrow({ where: { code: "CASH" } })).id;
    expenseCategoryId = (await db.expenseCategory.findFirstOrThrow({ where: { isActive: true } }))
      .id;
  });
  afterAll(async () => {
    await db.$disconnect();
  });
  it("adds approved-cost stock, reduces FIFO, preserves movements, and retries once", async () => {
    const opening = { ...command("0", "5", "Opening Stock"), date: "2036-01-16" };
    const results = await Promise.all([adjustStock(opening, actor), adjustStock(opening, actor)]);
    expect(results[0].id).toBe(results[1].id);
    await adjustStock(command("5", "8", "Count Correction", "20"), actor);
    await adjustStock({ ...command("8", "4"), reason: "Damage" }, actor);
    const stock = (await listStock({ page: 1, productId })).items[0]!;
    expect(stock.onHand.toString()).toBe("4");
    expect(stock.value.toString()).toBe("70");
    expect(
      (await listMovements({ page: 1, productId })).items.every((m) =>
        m.href?.startsWith("/inventory/adjustments/"),
      ),
    ).toBe(true);
    await expect(adjustStock(command("8", "2"), actor)).rejects.toThrow("Stock has changed");
    await expect(adjustStock({ ...command("4", "5"), unitCost: "0" }, actor)).rejects.toThrow(
      "approved unit cost",
    );
    expect((await listStock({ page: 1, productId })).items[0]!.onHand.toString()).toBe("4");
    await expect(
      db.stockMovement.updateMany({
        where: { productId, adjustmentLineId: { not: null } },
        data: { quantity: "99" },
      }),
    ).rejects.toThrow();
  });
  it("finalizes once, rejects overselling, returns original costs and reconciles statements/P&L", async () => {
    const beforeSales = await profitAndLoss(date, date);
    const input = {
      requestKey: randomUUID(),
      customerId,
      invoiceDate: date,
      invoiceDiscountAmount: "0",
      lines: [{ productId, quantity: "2", unitPrice: "100", lineDiscountAmount: "0" }],
    };
    const [a, b] = await Promise.all([
      createInvoiceDraft(input, actor),
      createInvoiceDraft(input, actor),
    ]);
    expect(a.id).toBe(b.id);
    await Promise.all([postInvoice(a.id, actor), postInvoice(a.id, actor)]);
    const allocations = await db.saleLotAllocation.findMany({
      where: { salesInvoiceLine: { salesInvoiceId: a.id } },
    });
    expect(allocations.map((l) => l.unitCostSnapshot.toString()).sort()).toEqual(["10", "20"]);
    const tooMany = await createInvoiceDraft(
      { ...input, requestKey: randomUUID(), lines: [{ ...input.lines[0]!, quantity: "3" }] },
      actor,
    );
    await expect(postInvoice(tooMany.id, actor)).rejects.toThrow("Insufficient");
    expect(await db.customerLedgerEntry.count({ where: { salesInvoiceId: tooMany.id } })).toBe(0);
    const line = await db.salesInvoiceLine.findFirstOrThrow({ where: { salesInvoiceId: a.id } });
    await postSaleReturn(
      {
        requestKey: randomUUID(),
        salesInvoiceId: a.id,
        returnDate: date,
        reason: "Customer Return",
        lines: [{ salesInvoiceLineId: line.id, quantity: "1" }],
      },
      actor,
    );
    const statement = await getStatement("customer", customerId, { page: 1, from: date, to: date });
    expect(statement?.balance).toBe("100.00");
    expect(statement?.closing.toString()).toBe("100");
    const baseline = await profitAndLoss(date, date);
    expect(new Decimal(baseline.netSales).minus(beforeSales.netSales).toFixed(2)).toBe("100.00");
    expect(new Decimal(baseline.cogs).minus(beforeSales.cogs).toFixed(2)).toBe("20.00");
    const expense = await createExpense(
      {
        requestKey: randomUUID(),
        expenseDate: date,
        expenseCategoryId,
        paymentMethodId: cash,
        amount: "12.50",
        description: "Demo acceptance",
      },
      actor,
    );
    const result = await profitAndLoss(date, date);
    expect(result.netSales).toBe(baseline.netSales);
    expect(result.cogs).toBe(baseline.cogs);
    expect(new Decimal(baseline.netProfit).minus(result.netProfit).toFixed(2)).toBe("12.50");
    await voidExpense(expense.id, { reason: "Acceptance cancellation" }, actor);
    expect((await profitAndLoss(date, date)).netProfit).toBe(baseline.netProfit);
  });
  it("serializes simultaneous physical stock counts", async () => {
    const current = (await listStock({ page: 1, productId })).items[0]!.onHand.toString();
    const commands = [command(current, "1"), command(current, "2")];
    const results = await Promise.allSettled(commands.map((c) => adjustStock(c, actor)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(adjustStock(command("1", "-1"), actor)).rejects.toThrow();
    await expect(adjustStock(command("1", "2"), { ...actor, role: "STAFF" })).rejects.toThrow(
      "permission",
    );
  });
  it("estimates and atomic retryable conversion create no stock, COGS or receivable", async () => {
    const stockBefore = (await listStock({ page: 1, productId })).items[0]!.onHand.toString();
    const balanceBefore = (await getStatement("customer", customerId, { page: 1 }))!.balance;
    const estimate = await saveEstimate(
      {
        requestKey: randomUUID(),
        customerId,
        invoiceDate: date,
        validUntil: "2036-02-01",
        invoiceDiscountAmount: "5",
        lines: [{ productId, quantity: "999", unitPrice: "100", lineDiscountAmount: "0" }],
      },
      actor,
    );
    const invoices = await Promise.all([
      convertEstimate(estimate.id, actor),
      convertEstimate(estimate.id, actor),
    ]);
    expect(invoices[0].id).toBe(invoices[1].id);
    expect(
      (await db.salesInvoice.findUniqueOrThrow({ where: { id: invoices[0].id } })).status,
    ).toBe("DRAFT");
    expect(
      await db.saleLotAllocation.count({
        where: { salesInvoiceLine: { salesInvoiceId: invoices[0].id } },
      }),
    ).toBe(0);
    expect((await listStock({ page: 1, productId })).items[0]!.onHand.toString()).toBe(stockBefore);
    expect((await getStatement("customer", customerId, { page: 1 }))!.balance).toBe(balanceBefore);
    await expect(
      saveEstimate(
        {
          requestKey: estimate.requestKey,
          customerId,
          invoiceDate: date,
          invoiceDiscountAmount: "0",
          lines: [{ productId, quantity: "1", unitPrice: "1", lineDiscountAmount: "0" }],
        },
        actor,
        estimate.id,
      ),
    ).rejects.toThrow("cannot be edited");
  });
});

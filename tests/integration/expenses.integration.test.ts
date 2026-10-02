import "dotenv/config";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedFoundationData } from "../../prisma/seed-data";
import type { AuthorizedUser } from "../../src/lib/auth/authorization";
import { prisma as db } from "../../src/lib/db/prisma";
import {
  expenseTotalsByCategory,
  totalExpensesByDateRange,
} from "../../src/modules/expenses/queries";
import { createExpense, voidExpense } from "../../src/modules/expenses/services";

if (
  process.env["STOCKFLOW_DATABASE_TARGET"] !== "development-disposable" ||
  !process.env["DIRECT_URL"] ||
  !process.env["DATABASE_URL"]
) {
  throw new Error("Expense integration tests require a confirmed disposable development database");
}

const marker = `EXP-IT-${randomUUID()}`;
const date = "2026-10-03";
let actor: AuthorizedUser;
let categoryId: string;
let paymentMethodId: string;

describe("miscellaneous expenses", () => {
  beforeAll(async () => {
    await seedFoundationData(db);
    const user = await db.user.create({
      data: { name: marker, email: `${randomUUID()}@example.test`, role: "ADMIN" },
    });
    actor = { ...user, isActive: true };
    categoryId = (
      await db.expenseCategory.findUniqueOrThrow({ where: { name: "Loading / Unloading" } })
    ).id;
    paymentMethodId = (await db.paymentMethod.findUniqueOrThrow({ where: { code: "CASH" } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const command = () => ({
    requestKey: randomUUID(),
    expenseDate: date,
    expenseCategoryId: categoryId,
    amount: "3500",
    paymentMethodId,
    description: marker,
  });

  it("posts idempotently without changing inventory and aggregates posted totals", async () => {
    const before = await Promise.all([db.stockMovement.count(), db.inventoryLot.count()]);
    const totalBefore = new Decimal(
      (await totalExpensesByDateRange(date, date))._sum.amount?.toString() ?? 0,
    );
    const categoryBefore = new Decimal(
      (await expenseTotalsByCategory(date, date))
        .find((row) => row.expenseCategoryId === categoryId)
        ?._sum.amount?.toString() ?? 0,
    );
    const input = command();
    const first = await createExpense(input, actor);
    const second = await createExpense(input, actor);
    expect(second.id).toBe(first.id);
    expect(await Promise.all([db.stockMovement.count(), db.inventoryLot.count()])).toEqual(before);
    expect(
      new Decimal((await totalExpensesByDateRange(date, date))._sum.amount?.toString() ?? 0)
        .minus(totalBefore)
        .toString(),
    ).toBe("3500");
    expect(
      new Decimal(
        (await expenseTotalsByCategory(date, date))
          .find((row) => row.expenseCategoryId === categoryId)
          ?._sum.amount?.toString() ?? 0,
      )
        .minus(categoryBefore)
        .toString(),
    ).toBe("3500");
  });

  it("rejects inactive categories, nonpositive amounts, and staff", async () => {
    const inactive = await db.expenseCategory.create({
      data: { name: `${marker}-inactive`, isActive: false },
    });
    await expect(
      createExpense({ ...command(), expenseCategoryId: inactive.id }, actor),
    ).rejects.toThrow("active expense category");
    await expect(createExpense({ ...command(), amount: "0" }, actor)).rejects.toThrow(
      "greater than zero",
    );
    await expect(createExpense(command(), { ...actor, role: "STAFF" })).rejects.toThrow(
      "permission",
    );
  });

  it("voids with an audit trail and preserves immutable financial values", async () => {
    const expense = await createExpense(command(), actor);
    const voided = await voidExpense(expense.id, { reason: "Entered twice" }, actor);
    expect(voided.status).toBe("VOID");
    expect(voided.voidedById).toBe(actor.id);
    await expect(
      db.expense.update({ where: { id: expense.id }, data: { amount: "1" } }),
    ).rejects.toThrow();
    await expect(db.expense.delete({ where: { id: expense.id } })).rejects.toThrow();
  });
});

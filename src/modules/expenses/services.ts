import type { AuthorizedUser } from "@/lib/auth/authorization";
import { assertMasterDataAdmin, assertOperationalWriter } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { nextDocumentNumber } from "@/lib/db/document-number";
import { runInBusinessTransaction } from "@/lib/db/transaction";
import { decimal } from "@/lib/decimal/decimal";
import { ApplicationError } from "@/lib/errors/application-error";
import { parseBusinessDate } from "@/lib/validation/business-date";
import { parseCommand } from "@/lib/validation/command";
import { parseIdentifier } from "@/lib/validation/identifier";
import { normalizeOptionalText } from "@/lib/validation/normalization";
import { translatePrismaError } from "@/lib/validation/prisma-errors";

import {
  expenseCategoryCommandSchema,
  expenseCommandSchema,
  voidExpenseCommandSchema,
  type ExpenseCategoryCommand,
  type ExpenseCommand,
} from "./validation";

export async function createExpense(input: ExpenseCommand, actor: AuthorizedUser) {
  assertOperationalWriter(actor);
  return runInBusinessTransaction(prisma, async (transaction) => {
    const command = parseCommand(expenseCommandSchema, input);
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${command.requestKey}, 0))::text`;
    const existing = await transaction.expense.findUnique({
      where: { requestKey: command.requestKey },
    });
    if (existing) return existing;

    const amount = decimal(command.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new ApplicationError("VALIDATION_ERROR", "Amount must be greater than zero");
    }
    const [category, paymentMethod] = await Promise.all([
      transaction.expenseCategory.findUnique({ where: { id: command.expenseCategoryId } }),
      transaction.paymentMethod.findUnique({ where: { id: command.paymentMethodId } }),
    ]);
    if (!category?.isActive) {
      throw new ApplicationError("VALIDATION_ERROR", "Select an active expense category");
    }
    if (!paymentMethod?.isActive) {
      throw new ApplicationError("VALIDATION_ERROR", "Select an active payment method");
    }

    const postedAt = new Date();
    return transaction.expense.create({
      data: {
        requestKey: command.requestKey,
        expenseNumber: await nextDocumentNumber(transaction, "expense"),
        status: "POSTED",
        expenseCategoryId: category.id,
        expenseDate: parseBusinessDate(command.expenseDate, "Expense date"),
        amount: amount.toFixed(2),
        description: command.description.trim(),
        payeeName: normalizeOptionalText(command.payeeName),
        paymentMethodId: paymentMethod.id,
        reference: normalizeOptionalText(command.reference),
        notes: normalizeOptionalText(command.notes),
        createdById: actor.id,
        postedAt,
      },
    });
  });
}

export async function voidExpense(id: string, input: { reason: string }, actor: AuthorizedUser) {
  assertOperationalWriter(actor);
  id = parseIdentifier(id, "Expense identifier");
  const command = parseCommand(voidExpenseCommandSchema, input);
  return runInBusinessTransaction(prisma, async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "Expense" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const expense = await transaction.expense.findUnique({ where: { id } });
    if (!expense) throw new ApplicationError("NOT_FOUND", "Expense was not found");
    if (expense.status === "VOID") return expense;
    if (expense.status !== "POSTED") {
      throw new ApplicationError("CONFLICT", "Only a posted expense can be voided");
    }
    return transaction.expense.update({
      where: { id },
      data: {
        status: "VOID",
        voidedAt: new Date(),
        voidedById: actor.id,
        voidReason: command.reason.trim(),
      },
    });
  });
}

function categoryData(command: ExpenseCategoryCommand) {
  return {
    name: command.name.trim(),
    description: normalizeOptionalText(command.description),
  };
}

export async function createExpenseCategory(input: ExpenseCategoryCommand, actor: AuthorizedUser) {
  assertMasterDataAdmin(actor);
  const command = parseCommand(expenseCategoryCommandSchema, input);
  try {
    return await prisma.expenseCategory.create({ data: categoryData(command) });
  } catch (error) {
    translatePrismaError(error, "An expense category with this name already exists");
  }
}

export async function updateExpenseCategory(
  id: string,
  input: ExpenseCategoryCommand,
  actor: AuthorizedUser,
) {
  assertMasterDataAdmin(actor);
  id = parseIdentifier(id, "Expense category identifier");
  const command = parseCommand(expenseCategoryCommandSchema, input);
  try {
    return await prisma.expenseCategory.update({ where: { id }, data: categoryData(command) });
  } catch (error) {
    translatePrismaError(error, "An expense category with this name already exists");
  }
}

export async function setExpenseCategoryActive(
  id: string,
  isActive: boolean,
  actor: AuthorizedUser,
) {
  assertMasterDataAdmin(actor);
  id = parseIdentifier(id, "Expense category identifier");
  try {
    return await prisma.expenseCategory.update({ where: { id }, data: { isActive } });
  } catch (error) {
    translatePrismaError(error, "Expense category status could not be changed");
  }
}

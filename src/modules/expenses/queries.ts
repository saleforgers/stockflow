import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { parseBusinessDate } from "@/lib/validation/business-date";
import { DEFAULT_PAGE_SIZE, paginationFor } from "@/lib/pagination";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validIdentifier(value: string | undefined): string | undefined {
  return value && UUID_PATTERN.test(value) ? value : undefined;
}

function validDate(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

export interface ExpenseFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  paymentMethodId?: string;
  status?: "POSTED" | "VOID";
}

function expenseWhere(input: ExpenseFilters): Prisma.ExpenseWhereInput {
  const categoryId = validIdentifier(input.categoryId);
  const paymentMethodId = validIdentifier(input.paymentMethodId);
  const dateFrom = validDate(input.dateFrom);
  const dateTo = validDate(input.dateTo);
  return {
    ...(input.status ? { status: input.status } : {}),
    ...(categoryId ? { expenseCategoryId: categoryId } : {}),
    ...(paymentMethodId ? { paymentMethodId } : {}),
    ...(dateFrom || dateTo
      ? {
          expenseDate: {
            ...(dateFrom ? { gte: parseBusinessDate(dateFrom, "From date") } : {}),
            ...(dateTo ? { lte: parseBusinessDate(dateTo, "To date") } : {}),
          },
        }
      : {}),
    ...(input.search
      ? {
          OR: [
            { expenseNumber: { contains: input.search, mode: "insensitive" } },
            { description: { contains: input.search, mode: "insensitive" } },
            { payeeName: { contains: input.search, mode: "insensitive" } },
            { reference: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listExpenses(input: ExpenseFilters & { page: number }) {
  const where = expenseWhere(input);
  const totalsWhere: Prisma.ExpenseWhereInput = { ...where, status: "POSTED" };
  const [items, total, amount] = await prisma.$transaction([
    prisma.expense.findMany({
      where,
      include: {
        expenseCategory: { select: { name: true } },
        paymentMethod: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      ...paginationFor(input.page),
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where: totalsWhere, _sum: { amount: true } }),
  ]);
  return { items, total, filteredAmount: amount._sum.amount ?? 0, pageSize: DEFAULT_PAGE_SIZE };
}

export function getExpense(id: string) {
  return prisma.expense.findUnique({
    where: { id },
    include: {
      expenseCategory: true,
      paymentMethod: true,
      createdBy: { select: { name: true } },
      voidedBy: { select: { name: true } },
    },
  });
}

export function getExpenseFormOptions() {
  return Promise.all([
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.paymentMethod.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]).then(([categories, paymentMethods]) => ({ categories, paymentMethods }));
}

export function getExpenseFilterOptions() {
  return Promise.all([
    prisma.expenseCategory.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.paymentMethod.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]).then(([categories, paymentMethods]) => ({ categories, paymentMethods }));
}

export async function listExpenseCategories(input: {
  search?: string;
  active?: boolean;
  page: number;
}) {
  const where: Prisma.ExpenseCategoryWhereInput = {
    ...(typeof input.active === "boolean" ? { isActive: input.active } : {}),
    ...(input.search ? { name: { contains: input.search, mode: "insensitive" } } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.expenseCategory.findMany({
      where,
      include: { _count: { select: { expenses: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      ...paginationFor(input.page),
    }),
    prisma.expenseCategory.count({ where }),
  ]);
  return { items, total, pageSize: DEFAULT_PAGE_SIZE };
}

export function getExpenseCategory(id: string) {
  return prisma.expenseCategory.findUnique({ where: { id } });
}

export function totalExpensesByDateRange(dateFrom: string, dateTo: string) {
  return prisma.expense.aggregate({
    where: {
      status: "POSTED",
      expenseDate: {
        gte: parseBusinessDate(dateFrom, "From date"),
        lte: parseBusinessDate(dateTo, "To date"),
      },
    },
    _sum: { amount: true },
  });
}

export function expenseTotalsByCategory(dateFrom: string, dateTo: string) {
  return prisma.expense.groupBy({
    by: ["expenseCategoryId"],
    where: {
      status: "POSTED",
      expenseDate: {
        gte: parseBusinessDate(dateFrom, "From date"),
        lte: parseBusinessDate(dateTo, "To date"),
      },
    },
    _sum: { amount: true },
    orderBy: { expenseCategoryId: "asc" },
  });
}

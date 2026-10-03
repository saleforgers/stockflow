"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/actions/action-result";
import { toActionFailure } from "@/lib/actions/action-result";
import { requireRole } from "@/lib/auth/session";

import {
  createExpense,
  createExpenseCategory,
  setExpenseCategoryActive,
  updateExpenseCategory,
  voidExpense,
} from "./services";

function expenseInput(data: FormData) {
  return {
    requestKey: String(data.get("requestKey") ?? ""),
    expenseDate: String(data.get("expenseDate") ?? ""),
    expenseCategoryId: String(data.get("expenseCategoryId") ?? ""),
    amount: String(data.get("amount") ?? ""),
    paymentMethodId: String(data.get("paymentMethodId") ?? ""),
    description: String(data.get("description") ?? ""),
    payeeName: String(data.get("payeeName") ?? ""),
    reference: String(data.get("reference") ?? ""),
    notes: String(data.get("notes") ?? ""),
  };
}

export async function createExpenseAction(
  _previous: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  let expenseId: string;
  try {
    const expense = await createExpense(
      expenseInput(data),
      await requireRole(["ADMIN", "MANAGER"]),
    );
    expenseId = expense.id;
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/reports", "layout");
  redirect(`/expenses/${expenseId}?success=created`);
}

export async function voidExpenseAction(
  id: string,
  _previous: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    await voidExpense(
      id,
      { reason: String(data.get("reason") ?? "") },
      await requireRole(["ADMIN", "MANAGER"]),
    );
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/reports", "layout");
  revalidatePath(`/expenses/${id}`);
  redirect(`/expenses/${id}?success=voided`);
}

function categoryInput(data: FormData) {
  return {
    name: String(data.get("name") ?? ""),
    description: String(data.get("description") ?? ""),
  };
}

export async function createExpenseCategoryAction(
  _previous: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    await createExpenseCategory(categoryInput(data), await requireRole(["ADMIN"]));
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/expense-categories");
  redirect("/expense-categories?success=created");
}

export async function updateExpenseCategoryAction(
  id: string,
  _previous: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    await updateExpenseCategory(id, categoryInput(data), await requireRole(["ADMIN"]));
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/expense-categories");
  redirect("/expense-categories?success=updated");
}

export async function setExpenseCategoryActiveAction(id: string, active: boolean): Promise<void> {
  await setExpenseCategoryActive(id, active, await requireRole(["ADMIN"]));
  revalidatePath("/expense-categories");
  revalidatePath("/expenses/new");
}

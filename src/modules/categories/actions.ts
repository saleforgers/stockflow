"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/actions/action-result";
import { toActionFailure } from "@/lib/actions/action-result";
import { requireRole } from "@/lib/auth/session";

import { createCategory, setCategoryActive, updateCategory } from "./services";

function inputFrom(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    parentId: String(formData.get("parentId") ?? ""),
  };
}

export async function createCategoryAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createCategory(inputFrom(formData), await requireRole(["ADMIN"]));
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/categories");
  redirect("/categories?success=created");
}

export async function updateCategoryAction(
  id: string,
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await updateCategory(id, inputFrom(formData), await requireRole(["ADMIN"]));
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/categories");
  redirect("/categories?success=updated");
}

export async function setCategoryActiveAction(id: string, isActive: boolean): Promise<void> {
  await setCategoryActive(id, isActive, await requireRole(["ADMIN"]));
  revalidatePath("/categories");
}

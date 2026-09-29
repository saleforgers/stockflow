"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/actions/action-result";
import { toActionFailure } from "@/lib/actions/action-result";
import { requireRole } from "@/lib/auth/session";

import { createUnit, setUnitActive, updateUnit } from "./services";

const inputFrom = (formData: FormData) => ({
  code: String(formData.get("code") ?? ""),
  name: String(formData.get("name") ?? ""),
  decimalScale: Number(formData.get("decimalScale") ?? Number.NaN),
});

export async function createUnitAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createUnit(inputFrom(formData), await requireRole(["ADMIN"]));
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/units");
  redirect("/units?success=created");
}

export async function updateUnitAction(
  id: string,
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await updateUnit(id, inputFrom(formData), await requireRole(["ADMIN"]));
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/units");
  redirect("/units?success=updated");
}

export async function setUnitActiveAction(id: string, isActive: boolean): Promise<void> {
  await setUnitActive(id, isActive, await requireRole(["ADMIN"]));
  revalidatePath("/units");
}

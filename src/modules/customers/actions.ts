"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/actions/action-result";
import { toActionFailure } from "@/lib/actions/action-result";
import { requireRole } from "@/lib/auth/session";
import { createCustomer, setCustomerActive, updateCustomer } from "./services";
const inputFrom = (data: FormData) => ({
  name: String(data.get("name") ?? ""),
  phone: String(data.get("phone") ?? ""),
  email: String(data.get("email") ?? ""),
  address: String(data.get("address") ?? ""),
  notes: String(data.get("notes") ?? ""),
});
export async function createCustomerAction(
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    await createCustomer(inputFrom(data), await requireRole(["ADMIN"]));
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/customers");
  redirect("/customers?success=created");
}
export async function updateCustomerAction(
  id: string,
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    await updateCustomer(id, inputFrom(data), await requireRole(["ADMIN"]));
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/customers");
  redirect("/customers?success=updated");
}
export async function setCustomerActiveAction(id: string, active: boolean): Promise<void> {
  await setCustomerActive(id, active, await requireRole(["ADMIN"]));
  revalidatePath("/customers");
}

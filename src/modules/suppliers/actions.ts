"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/actions/action-result";
import { toActionFailure } from "@/lib/actions/action-result";
import { requireRole } from "@/lib/auth/session";
import type { QuickPartyActionResult } from "@/lib/parties/quick-create";
import {
  createSupplier,
  createTransactionSupplier,
  setSupplierActive,
  updateSupplier,
} from "./services";

const inputFrom = (data: FormData) => ({
  name: String(data.get("name") ?? ""),
  contactPerson: String(data.get("contactPerson") ?? ""),
  phone: String(data.get("phone") ?? ""),
  email: String(data.get("email") ?? ""),
  address: String(data.get("address") ?? ""),
  notes: String(data.get("notes") ?? ""),
});
export async function createSupplierAction(
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    await createSupplier(inputFrom(data), await requireRole(["ADMIN"]));
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/suppliers");
  redirect("/suppliers?success=created");
}
export async function quickCreateSupplierAction(data: FormData): Promise<QuickPartyActionResult> {
  try {
    const supplier = await createTransactionSupplier(inputFrom(data), await requireRole(["ADMIN"]));
    revalidatePath("/suppliers");
    revalidatePath("/purchases");
    return {
      ok: true,
      message: "Supplier added",
      party: {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        accountBalance: "0.00",
      },
    };
  } catch (error) {
    return toActionFailure(error);
  }
}
export async function updateSupplierAction(
  id: string,
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    await updateSupplier(id, inputFrom(data), await requireRole(["ADMIN"]));
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/suppliers");
  redirect("/suppliers?success=updated");
}
export async function setSupplierActiveAction(id: string, active: boolean): Promise<void> {
  await setSupplierActive(id, active, await requireRole(["ADMIN"]));
  revalidatePath("/suppliers");
}

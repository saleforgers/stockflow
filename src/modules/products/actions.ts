"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/actions/action-result";
import { toActionFailure } from "@/lib/actions/action-result";
import { requireRole } from "@/lib/auth/session";
import { createProduct, setProductActive, updateProduct } from "./services";

function inputFrom(data: FormData) {
  const keys = data.getAll("specKey").map(String);
  const values = data.getAll("specValue").map(String);
  return {
    sku: String(data.get("sku") ?? ""),
    name: String(data.get("name") ?? ""),
    description: String(data.get("description") ?? ""),
    categoryId: String(data.get("categoryId") ?? ""),
    inventoryUnitId: String(data.get("inventoryUnitId") ?? ""),
    preferredSupplierId: String(data.get("preferredSupplierId") ?? ""),
    defaultPurchasePrice: String(data.get("defaultPurchasePrice") ?? ""),
    defaultSellingPrice: String(data.get("defaultSellingPrice") ?? ""),
    openingStockQuantity: String(data.get("openingStockQuantity") ?? "0"),
    lowStockThreshold: String(data.get("lowStockThreshold") ?? "0"),
    specifications: keys.map((key, index) => ({ key, value: values[index] ?? "" })),
  };
}
export async function createProductAction(
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    await createProduct(inputFrom(data), await requireRole(["ADMIN"]));
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/products");
  redirect("/products?success=created");
}
export async function updateProductAction(
  id: string,
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    await updateProduct(id, inputFrom(data), await requireRole(["ADMIN"]));
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect(`/products/${id}?success=updated`);
}
export async function setProductActiveAction(id: string, active: boolean): Promise<void> {
  await setProductActive(id, active, await requireRole(["ADMIN"]));
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
}

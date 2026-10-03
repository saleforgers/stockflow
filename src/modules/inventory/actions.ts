"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { toActionFailure, type ActionResult } from "@/lib/actions/action-result";
import { adjustStock, type AdjustmentCommand } from "./services";
export async function adjustmentAction(
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  let result;
  try {
    result = await adjustStock(
      JSON.parse(String(data.get("payload"))) as AdjustmentCommand,
      await requireRole(["ADMIN", "MANAGER"]),
    );
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/", "layout");
  redirect(`/inventory/adjustments/${result.id}?success=1`);
}

"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { toActionFailure, type ActionResult } from "@/lib/actions/action-result";
import { saveEstimate, convertEstimate, setEstimateStatus, type EstimateCommand } from "./services";
export async function saveEstimateAction(
  id: string | null,
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  let result;
  try {
    const input = JSON.parse(String(data.get("payload"))) as EstimateCommand;
    input.validUntil = String(data.get("validUntil") ?? "");
    result = await saveEstimate(input, await requireRole(["ADMIN", "MANAGER"]), id ?? undefined);
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/estimates", "layout");
  redirect(`/estimates/${result.id}`);
}
export async function convertEstimateAction(
  id: string,
  _state: ActionResult,
): Promise<ActionResult> {
  void _state;
  let result;
  try {
    result = await convertEstimate(id, await requireRole(["ADMIN", "MANAGER"]));
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/estimates", "layout");
  revalidatePath("/sales");
  redirect(`/sales/${result.id}`);
}
export async function estimateStatusAction(
  id: string,
  status: "SENT" | "ACCEPTED" | "CANCELLED",
  _state: ActionResult,
): Promise<ActionResult> {
  void _state;
  try {
    await setEstimateStatus(id, status, await requireRole(["ADMIN", "MANAGER"]));
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/estimates", "layout");
  return { ok: true, message: "Estimate updated" };
}

"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { toActionFailure, type ActionResult } from "@/lib/actions/action-result";
import { removeDemoFixtures } from "./services";
export async function cleanupDemoAction(
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  let result;
  try {
    result = await removeDemoFixtures(
      {
        requestKey: String(data.get("requestKey")),
        fingerprint: String(data.get("fingerprint")),
        confirmation: String(data.get("confirmation")),
      },
      await requireRole(["ADMIN"]),
    );
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/", "layout");
  redirect(`/settings/data-cleanup?completed=${result.id}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/actions/action-result";
import { toActionFailure } from "@/lib/actions/action-result";
import { requireRole } from "@/lib/auth/session";
import { ApplicationError } from "@/lib/errors/application-error";
import {
  createPurchaseDraft,
  postPurchase,
  postPurchaseReturn,
  recordSupplierPayment,
  updatePurchaseDraft,
} from "./services";
import type {
  PurchaseDraftCommand,
  PurchasePostingPayment,
  PurchaseReturnCommand,
  SupplierPaymentCommand,
} from "./validation";

function jsonPayload<T>(data: FormData): T {
  try {
    return JSON.parse(String(data.get("payload") ?? "")) as T;
  } catch (cause) {
    throw new ApplicationError("VALIDATION_ERROR", "The submitted form data is malformed", {
      cause,
    });
  }
}

const operationalUser = () => requireRole(["ADMIN", "MANAGER"]);

export async function createPurchaseDraftAction(
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  let id: string;
  try {
    id = (
      await createPurchaseDraft(jsonPayload<PurchaseDraftCommand>(data), await operationalUser())
    ).id;
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/purchases");
  redirect(`/purchases/${id}?success=created`);
}

export async function updatePurchaseDraftAction(
  id: string,
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    await updatePurchaseDraft(id, jsonPayload<PurchaseDraftCommand>(data), await operationalUser());
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/purchases");
  revalidatePath(`/purchases/${id}`);
  redirect(`/purchases/${id}?success=updated`);
}

export async function postPurchaseAction(
  id: string,
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  void _state;
  try {
    const paymentType = String(data.get("paymentType") ?? "CREDIT");
    const payment =
      paymentType === "CREDIT"
        ? ({ paymentType: "CREDIT" } satisfies PurchasePostingPayment)
        : ({
            paymentType,
            paymentMethodId: String(data.get("paymentMethodId") ?? ""),
            amount: String(data.get("amount") ?? ""),
          } as PurchasePostingPayment);
    await postPurchase(id, await operationalUser(), payment);
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/purchases");
  revalidatePath(`/purchases/${id}`);
  redirect(`/purchases/${id}?success=posted`);
}

export async function recordSupplierPaymentAction(
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  let supplierId: string;
  try {
    const command = jsonPayload<SupplierPaymentCommand>(data);
    supplierId = command.supplierId;
    await recordSupplierPayment(command, await operationalUser());
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/purchases");
  revalidatePath(`/suppliers/${supplierId}/account`);
  redirect(`/suppliers/${supplierId}/account?success=payment`);
}

export async function postPurchaseReturnAction(
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  let purchaseId: string;
  try {
    const command = jsonPayload<PurchaseReturnCommand>(data);
    purchaseId = command.purchaseId;
    await postPurchaseReturn(command, await operationalUser());
  } catch (error) {
    return toActionFailure(error);
  }
  revalidatePath("/purchases");
  revalidatePath(`/purchases/${purchaseId}`);
  redirect(`/purchases/${purchaseId}?success=return`);
}

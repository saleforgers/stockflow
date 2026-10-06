"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { toActionFailure, type ActionResult } from "@/lib/actions/action-result";
import { ApplicationError } from "@/lib/errors/application-error";
import {
  createInvoiceDraft,
  updateInvoiceDraft,
  postInvoice,
  recordCustomerReceipt,
  postSaleReturn,
  allocateCustomerAdvance,
} from "./services";
import type { InvoiceDraftCommand, ReceiptCommand, SaleReturnCommand } from "./validation";
import { nonnegativeMoney } from "@/modules/purchases/calculations";
function paymentInput(data: FormData) {
  const amount = nonnegativeMoney(String(data.get("amount") ?? "").trim() || "0", "Paid Now");
  const paymentType = String(data.get("paymentType") ?? "").trim();

  return amount.gt(0)
    ? {
        amount: amount.toFixed(2),
        paymentMethodId: String(data.get("paymentMethodId")),
        paymentType: paymentType === "PARTIAL" ? "PARTIAL" : "PAID",
      }
    : undefined;
}
function payload<T>(data: FormData): T {
  try {
    return JSON.parse(String(data.get("payload"))) as T;
  } catch {
    throw new ApplicationError("VALIDATION_ERROR", "Malformed form data");
  }
}
async function invalidate() {
  revalidatePath("/inventory", "layout");
  revalidatePath("/reports", "layout");
  revalidatePath("/");
  revalidatePath("/sales");
  revalidatePath("/customers", "layout");
  revalidatePath("/products");
}
export async function saveInvoiceAction(
  id: string | null,
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  let result;
  let finalizeError = "";
  try {
    const user = await requireRole(["ADMIN", "MANAGER"]);
    const input = payload<InvoiceDraftCommand>(data);
    result = id ? await updateInvoiceDraft(id, input, user) : await createInvoiceDraft(input, user);
    if (data.get("intent") === "finalize") {
      try {
        await postInvoice(result.id, user, paymentInput(data));
      } catch (error) {
        const failure = toActionFailure(error);
        finalizeError = failure.message;
      }
    }
  } catch (error) {
    return toActionFailure(error);
  }
  await invalidate();
  revalidatePath(`/sales/${result.id}`);
  redirect(
    `/sales/${result.id}${finalizeError ? `?error=${encodeURIComponent(finalizeError)}` : data.get("intent") === "finalize" ? "?success=1" : ""}`,
  );
}
export async function postInvoiceAction(
  id: string,
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    await postInvoice(id, await requireRole(["ADMIN", "MANAGER"]), paymentInput(data));
  } catch (error) {
    return toActionFailure(error);
  }
  await invalidate();
  revalidatePath(`/sales/${id}`);
  redirect(`/sales/${id}?success=1`);
}
export async function receiptAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  let customerId;
  try {
    const c = payload<ReceiptCommand>(data);
    customerId = c.customerId;
    await recordCustomerReceipt(c, await requireRole(["ADMIN", "MANAGER"]));
  } catch (error) {
    return toActionFailure(error);
  }
  await invalidate();
  revalidatePath("/sales", "layout");
  redirect(`/customers/${customerId}/account`);
}
export async function returnAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  let id;
  try {
    const c = payload<SaleReturnCommand>(data);
    id = c.salesInvoiceId;
    await postSaleReturn(c, await requireRole(["ADMIN", "MANAGER"]));
  } catch (error) {
    return toActionFailure(error);
  }
  await invalidate();
  revalidatePath(`/sales/${id}`);
  redirect(`/sales/${id}`);
}
export async function advanceAction(
  customerId: string,
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    await allocateCustomerAdvance(
      {
        requestKey: String(data.get("requestKey")),
        paymentId: String(data.get("paymentId")),
        salesInvoiceId: String(data.get("salesInvoiceId")),
        amount: String(data.get("amount")),
      },
      await requireRole(["ADMIN", "MANAGER"]),
    );
  } catch (error) {
    return toActionFailure(error);
  }
  await invalidate();
  revalidatePath("/sales", "layout");
  redirect(`/customers/${customerId}/account`);
}

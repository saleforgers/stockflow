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
function payload<T>(data: FormData): T {
  try {
    return JSON.parse(String(data.get("payload"))) as T;
  } catch {
    throw new ApplicationError("VALIDATION_ERROR", "Malformed form data");
  }
}
async function invalidate() {
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
  try {
    const user = await requireRole(["ADMIN", "MANAGER"]);
    const input = payload<InvoiceDraftCommand>(data);
    result = id ? await updateInvoiceDraft(id, input, user) : await createInvoiceDraft(input, user);
  } catch (error) {
    return toActionFailure(error);
  }
  await invalidate();
  revalidatePath(`/sales/${result.id}`);
  redirect(`/sales/${result.id}`);
}
export async function postInvoiceAction(
  id: string,
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    const paymentType = String(data.get("paymentType") ?? "CREDIT");
    const amount = String(data.get("amount") ?? "").trim();
    await postInvoice(
      id,
      await requireRole(["ADMIN", "MANAGER"]),
      paymentType === "CREDIT"
        ? undefined
        : {
            paymentType: paymentType === "PAID" ? "PAID" : "PARTIAL",
            amount,
            paymentMethodId: String(data.get("paymentMethodId")),
          },
    );
  } catch (error) {
    return toActionFailure(error);
  }
  await invalidate();
  revalidatePath(`/sales/${id}`);
  redirect(`/sales/${id}`);
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

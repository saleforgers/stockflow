import { z } from "zod";
import { ApplicationError } from "@/lib/errors/application-error";
import { parseCommand } from "@/lib/validation/command";
import { isIdentifier } from "@/lib/validation/identifier";
import { nonnegativeMoney } from "@/modules/purchases/calculations";

export type InvoicePaymentType = "PAID" | "CREDIT" | "PARTIAL";
export type InvoicePostingPayment = {
  paymentType: "PAID" | "PARTIAL";
  paymentMethodId: string;
  amount: string;
};

const postingPaymentSchema = z.object({
  paymentType: z.enum(["PAID", "CREDIT", "PARTIAL"]),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a nonnegative payment amount"),
  paymentMethodId: z.string().trim(),
});

export function parseInvoicePostingPayment(input: unknown): InvoicePostingPayment | undefined {
  const command = parseCommand(postingPaymentSchema, input);
  const amount = nonnegativeMoney(command.amount, "Paid Now");
  if (command.paymentType === "CREDIT") {
    if (!amount.isZero())
      throw new ApplicationError("VALIDATION_ERROR", "Credit invoices cannot include a payment");
    return undefined;
  }
  if (command.paymentType === "PARTIAL" && amount.isZero())
    throw new ApplicationError("VALIDATION_ERROR", "Partial payment must be greater than zero");
  if (amount.gt(0) && !isIdentifier(command.paymentMethodId))
    throw new ApplicationError("VALIDATION_ERROR", "Please select a valid payment method.");
  return {
    paymentType: command.paymentType,
    paymentMethodId: command.paymentMethodId,
    amount: amount.toFixed(2),
  };
}

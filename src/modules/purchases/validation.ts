import { z } from "zod";

const optionalText = z.string().trim().max(2000).optional().nullable();
const decimalString = z.string().trim().min(1).max(40);

export const purchaseLineCommandSchema = z.object({
  productId: z.string().uuid(),
  quantity: decimalString,
  unitCost: decimalString,
  lineDiscountAmount: decimalString.default("0"),
  notes: optionalText,
});

export const purchasePostingPaymentSchema = z.discriminatedUnion("paymentType", [
  z.object({ paymentType: z.literal("CREDIT") }),
  z.object({
    paymentType: z.enum(["PAID", "PARTIAL"]),
    paymentMethodId: z.string().uuid(),
    amount: decimalString,
  }),
]);

export const purchaseLotCommandSchema = z.object({
  id: z.string().uuid().optional(),
  supplierLotReference: z.string().trim().max(160).optional().nullable(),
  receivedAt: z.string().trim().min(1),
  notes: optionalText,
  lines: z.array(purchaseLineCommandSchema).min(1, "Each lot needs at least one product line"),
});

export const purchaseDraftCommandSchema = z.object({
  supplierId: z.string().uuid(),
  purchaseDate: z.string().trim().min(1),
  supplierInvoiceRef: z.string().trim().max(160).optional().nullable(),
  additionalCharges: decimalString.default("0"),
  notes: optionalText,
  lots: z.array(purchaseLotCommandSchema).min(1, "Add at least one purchase lot"),
});

export const supplierPaymentCommandSchema = z.object({
  supplierId: z.string().uuid(),
  paymentMethodId: z.string().uuid(),
  paymentDate: z.string().trim().min(1),
  amount: decimalString,
  reference: z.string().trim().max(160).optional().nullable(),
  notes: optionalText,
  allocations: z
    .array(
      z.object({
        purchaseId: z.string().uuid(),
        amount: decimalString,
      }),
    )
    .default([]),
});

export const purchaseReturnCommandSchema = z.object({
  purchaseId: z.string().uuid(),
  returnDate: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(500),
  notes: optionalText,
  lines: z
    .array(
      z.object({
        purchaseLineId: z.string().uuid(),
        quantity: decimalString,
      }),
    )
    .min(1, "Add at least one return line"),
});

export type PurchaseDraftCommand = z.infer<typeof purchaseDraftCommandSchema>;
export type SupplierPaymentCommand = z.infer<typeof supplierPaymentCommandSchema>;
export type PurchaseReturnCommand = z.infer<typeof purchaseReturnCommandSchema>;
export type PurchasePostingPayment = z.infer<typeof purchasePostingPaymentSchema>;

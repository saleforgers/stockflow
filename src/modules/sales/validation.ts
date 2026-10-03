import { z } from "zod";

const value = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, "Enter a nonnegative decimal amount")
  .max(22);
const text = z.string().trim().max(2000).optional().nullable();
export const invoiceDraftSchema = z.object({
  requestKey: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  invoiceDate: z.string().min(1),
  invoiceDiscountAmount: value.default("0"),
  notes: text,
  lines: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: value,
        unitPrice: value,
        lineDiscountAmount: value.default("0"),
        notes: text,
      }),
    )
    .min(1)
    .max(200),
});
export const receiptSchema = z.object({
  requestKey: z.string().uuid(),
  customerId: z.string().uuid(),
  paymentMethodId: z.string().uuid(),
  paymentDate: z.string().min(1),
  amount: value,
  reference: text,
  notes: text,
  allocations: z
    .array(z.object({ salesInvoiceId: z.string().uuid(), amount: value }))
    .max(200)
    .default([]),
});
export const returnSchema = z.object({
  requestKey: z.string().uuid(),
  salesInvoiceId: z.string().uuid(),
  returnDate: z.string().min(1),
  reason: z.string().trim().min(1).max(500),
  notes: text,
  lines: z
    .array(z.object({ salesInvoiceLineId: z.string().uuid(), quantity: value }))
    .min(1)
    .max(200),
});
export const advanceAllocationSchema = z.object({
  requestKey: z.string().uuid(),
  paymentId: z.string().uuid(),
  salesInvoiceId: z.string().uuid(),
  amount: value,
});
export type InvoiceDraftCommand = z.infer<typeof invoiceDraftSchema>;
export type ReceiptCommand = z.infer<typeof receiptSchema>;
export type SaleReturnCommand = z.infer<typeof returnSchema>;

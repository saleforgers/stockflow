import { z } from "zod";

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().nullable();

export const expenseCommandSchema = z.object({
  requestKey: z.string().uuid(),
  expenseDate: z.string().trim().min(1),
  expenseCategoryId: z.string().uuid(),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,16}(\.\d{1,2})?$/, "Enter a valid amount with at most 2 decimal places"),
  paymentMethodId: z.string().uuid(),
  description: z.string().trim().min(1, "Description is required").max(500),
  payeeName: optionalText(200),
  reference: optionalText(200),
  notes: optionalText(2000),
});

export const expenseCategoryCommandSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: optionalText(1000),
});

export const voidExpenseCommandSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export type ExpenseCommand = z.infer<typeof expenseCommandSchema>;
export type ExpenseCategoryCommand = z.infer<typeof expenseCategoryCommandSchema>;

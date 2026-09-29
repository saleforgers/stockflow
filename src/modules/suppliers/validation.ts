import { z } from "zod";

export const supplierCommandSchema = z.object({
  name: z.string().trim().min(2).max(160),
  contactPerson: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().email().max(254).nullable().optional(),
  ),
  address: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type SupplierCommand = z.infer<typeof supplierCommandSchema>;

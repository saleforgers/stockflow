import { z } from "zod";

export const unitCommandSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .regex(/^[A-Za-z0-9 _-]+$/),
  name: z.string().trim().min(2).max(80),
  decimalScale: z.coerce.number().int().min(0).max(4),
});

export type UnitCommand = z.infer<typeof unitCommandSchema>;

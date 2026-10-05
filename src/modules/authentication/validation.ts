import { z } from "zod";

export const firstAdminSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(12, "Password must contain at least 12 characters")
    .max(128, "Password must contain at most 128 characters"),
});

export type FirstAdminInput = z.infer<typeof firstAdminSchema>;

export const adminRecoverySchema = firstAdminSchema.pick({ email: true, password: true });

export type AdminRecoveryInput = z.infer<typeof adminRecoverySchema>;

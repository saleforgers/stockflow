import { z } from "zod";

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().uuid().nullable().optional(),
);

export const categoryCommandSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  parentId: optionalUuid,
});

export type CategoryCommand = z.infer<typeof categoryCommandSchema>;

import type { ZodType } from "zod";

import { ApplicationError } from "@/lib/errors/application-error";

export function parseCommand<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new ApplicationError("VALIDATION_ERROR", "Business command validation failed", {
      details: { issues: result.error.issues },
    });
  }

  return result.data;
}

import { z } from "zod";
import { ApplicationError } from "@/lib/errors/application-error";

const identifierSchema = z.string().uuid();

export function parseIdentifier(value: string, label = "Identifier"): string {
  const result = identifierSchema.safeParse(value);
  if (!result.success) throw new ApplicationError("VALIDATION_ERROR", `${label} is malformed`);
  return result.data;
}

export function isIdentifier(value: string): boolean {
  return identifierSchema.safeParse(value).success;
}

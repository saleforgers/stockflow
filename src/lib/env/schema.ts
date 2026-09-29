import { z } from "zod";

export const serverEnvironmentSchema = z.object({
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is required" })
    .url("DATABASE_URL must be a valid PostgreSQL URL")
    .refine(
      (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "DATABASE_URL must use the PostgreSQL protocol",
    ),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must contain at least 32 characters").optional(),
});

export const databaseAdministrationEnvironmentSchema = z.object({
  DIRECT_URL: z
    .string({ error: "DIRECT_URL is required" })
    .url("DIRECT_URL must be a valid PostgreSQL URL")
    .refine(
      (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "DIRECT_URL must use the PostgreSQL protocol",
    ),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type DatabaseAdministrationEnvironment = z.infer<
  typeof databaseAdministrationEnvironmentSchema
>;

export function parseServerEnvironment(
  environment: Record<string, string | undefined>,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}

export function parseDatabaseAdministrationEnvironment(
  environment: Record<string, string | undefined>,
): DatabaseAdministrationEnvironment {
  return databaseAdministrationEnvironmentSchema.parse(environment);
}

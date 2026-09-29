import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export type BusinessTransaction = Prisma.TransactionClient;

export interface TransactionOptions {
  readonly isolationLevel?: Prisma.TransactionIsolationLevel;
  readonly maxWaitMilliseconds?: number;
  readonly timeoutMilliseconds?: number;
}

export function runInBusinessTransaction<T>(
  client: PrismaClient,
  operation: (transaction: BusinessTransaction) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  return client.$transaction(operation, {
    isolationLevel: options.isolationLevel ?? "Serializable",
    maxWait: options.maxWaitMilliseconds ?? 5_000,
    timeout: options.timeoutMilliseconds ?? 10_000,
  });
}

import { prisma } from "@/lib/db/prisma";
import { runInBusinessTransaction, type BusinessTransaction } from "@/lib/db/transaction";
import { isRetryableTransactionError } from "@/lib/db/retryable-error";

/** Retry only rolled-back serialization/deadlock conflicts; callbacks have no external effects. */
export async function salesTransaction<T>(
  operation: (tx: BusinessTransaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await runInBusinessTransaction(prisma, operation, { timeoutMilliseconds: 20000 });
    } catch (error) {
      if (attempt >= 3 || !isRetryableTransactionError(error)) throw error;
    }
  }
}

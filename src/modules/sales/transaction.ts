import { prisma } from "@/lib/db/prisma";
import { runInBusinessTransaction, type BusinessTransaction } from "@/lib/db/transaction";

/** Retry only rolled-back serialization/deadlock conflicts; callbacks have no external effects. */
export async function salesTransaction<T>(
  operation: (tx: BusinessTransaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await runInBusinessTransaction(prisma, operation, { timeoutMilliseconds: 20000 });
    } catch (error) {
      const code = (error as { code?: string }).code;
      const sqlCode = (error as { meta?: { code?: string } }).meta?.code;
      if (attempt >= 3 || (code !== "P2034" && sqlCode !== "40001" && sqlCode !== "40P01"))
        throw error;
    }
  }
}

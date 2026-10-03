/** Prisma adapter versions wrap PostgreSQL SQLSTATE at different nesting levels. */
export function isRetryableTransactionError(error: unknown, depth = 0): boolean {
  if (depth > 6 || !error || typeof error !== "object") return false;
  const value = error as Record<string, unknown>;
  if (
    [value.code, value.originalCode, value.sqlState].some(
      (code) => code === "P2034" || code === "40001" || code === "40P01",
    )
  )
    return true;
  return ["meta", "cause", "driverAdapterError"].some((key) =>
    isRetryableTransactionError(value[key], depth + 1),
  );
}

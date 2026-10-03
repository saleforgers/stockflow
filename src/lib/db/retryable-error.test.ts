import { it, expect } from "vitest";
import { isRetryableTransactionError } from "./retryable-error";
it("retries only known serialization/deadlock SQLSTATE across adapter wrappers", () => {
  expect(
    isRetryableTransactionError({
      code: "P2010",
      meta: { driverAdapterError: { cause: { originalCode: "40001" } } },
    }),
  ).toBe(true);
  expect(isRetryableTransactionError({ code: "P2034" })).toBe(true);
  expect(isRetryableTransactionError({ code: "P2010", meta: { code: "40P01" } })).toBe(true);
  expect(isRetryableTransactionError({ code: "P2002" })).toBe(false);
  expect(isRetryableTransactionError({ cause: { originalCode: "23514" } })).toBe(false);
});

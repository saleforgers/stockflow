import { describe, expect, it } from "vitest";
import { parseInvoicePostingPayment } from "./posting-payment";

const paymentMethodId = "00000000-0000-4000-8000-000000000001";
describe("explicit invoice payment commands", () => {
  it("accepts credit without a receipt and rejects hidden nonzero payments", () => {
    expect(
      parseInvoicePostingPayment({ paymentType: "CREDIT", amount: "0", paymentMethodId: "" }),
    ).toBeUndefined();
    expect(() =>
      parseInvoicePostingPayment({ paymentType: "CREDIT", amount: "25", paymentMethodId }),
    ).toThrow("cannot include");
  });
  it("does not silently turn an empty partial payment into credit", () => {
    expect(() =>
      parseInvoicePostingPayment({ paymentType: "PARTIAL", amount: "0", paymentMethodId }),
    ).toThrow("greater than zero");
    expect(
      parseInvoicePostingPayment({ paymentType: "PARTIAL", amount: "25.50", paymentMethodId })
        ?.amount,
    ).toBe("25.50");
  });
  it("requires a real method for receipts and rejects invalid payment types and precision", () => {
    expect(() =>
      parseInvoicePostingPayment({ paymentType: "PAID", amount: "100", paymentMethodId: "" }),
    ).toThrow("payment method");
    expect(() =>
      parseInvoicePostingPayment({ paymentType: "UNKNOWN", amount: "0", paymentMethodId }),
    ).toThrow();
    expect(() =>
      parseInvoicePostingPayment({ paymentType: "PARTIAL", amount: "1.001", paymentMethodId }),
    ).toThrow();
  });
});

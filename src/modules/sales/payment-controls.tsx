"use client";

import Decimal from "decimal.js";
import type { InvoicePaymentType } from "./posting-payment";

export function SalesPaymentControls({
  paymentType,
  onPaymentTypeChange,
  amount,
  onAmountChange,
  methodId,
  onMethodChange,
  methods,
  total,
  walkIn,
}: {
  paymentType: InvoicePaymentType;
  onPaymentTypeChange: (type: InvoicePaymentType) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  methodId: string;
  onMethodChange: (id: string) => void;
  methods: { id: string; name: string }[];
  total: string;
  walkIn: boolean;
}) {
  const needsReceipt = paymentType !== "CREDIT" && new Decimal(total).gt(0);
  let error = "";
  if (paymentType === "PARTIAL") {
    try {
      const partial = new Decimal(amount || 0);
      if (
        !partial.isFinite() ||
        partial.lte(0) ||
        partial.gte(total) ||
        partial.decimalPlaces() > 2
      )
        error =
          "Enter a partial payment greater than zero and less than the invoice total (up to 2 decimals).";
    } catch {
      error = "Enter a valid partial payment amount.";
    }
  }
  return (
    <div className="space-y-4">
      {walkIn || new Decimal(total).isZero() ? (
        <input type="hidden" name="paymentType" value={paymentType} />
      ) : null}
      <label className="block space-y-1 text-sm font-medium">
        Invoice payment status
        <select
          className="input"
          name={walkIn || new Decimal(total).isZero() ? undefined : "paymentType"}
          value={paymentType}
          disabled={walkIn || new Decimal(total).isZero()}
          onChange={(event) => onPaymentTypeChange(event.target.value as InvoicePaymentType)}
        >
          <option value="PAID">Paid</option>
          <option value="CREDIT">Credit</option>
          <option value="PARTIAL">Partial payment</option>
        </select>
      </label>
      {walkIn ? (
        <p className="text-sm text-slate-500">
          Walk-in sales require full payment. Select a named customer for credit or partial payment.
        </p>
      ) : null}
      {needsReceipt ? (
        <label className="block space-y-1 text-sm font-medium">
          Payment method
          <select
            className="input"
            name="paymentMethodId"
            value={methodId}
            required
            onChange={(event) => onMethodChange(event.target.value)}
          >
            <option value="">Select payment method</option>
            {methods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {paymentType === "PARTIAL" ? (
        <label className="block space-y-1 text-sm font-medium">
          Paid Now (PKR)
          <input
            className="input"
            name="amount"
            inputMode="decimal"
            value={amount}
            required
            onChange={(event) => onAmountChange(event.target.value)}
          />
        </label>
      ) : (
        <>
          <input type="hidden" name="amount" value={amount} />
          <p className="text-sm text-slate-600">Paid Now: PKR {amount}</p>
        </>
      )}
      {error ? (
        <p className="alert-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

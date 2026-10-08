"use client";

import Decimal from "decimal.js";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { INITIAL_ACTION_RESULT, type ActionResult } from "@/lib/actions/action-result";

type PurchaseOption = {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  purchaseDate: string;
  outstanding: string;
};

export function SupplierPaymentForm({
  action,
  suppliers,
  paymentMethods,
  purchases,
  defaultDate,
  initialSupplierId = "",
}: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  suppliers: Array<{ id: string; name: string }>;
  paymentMethods: Array<{ id: string; name: string }>;
  purchases: PurchaseOption[];
  defaultDate: string;
  initialSupplierId?: string;
}) {
  const [result, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  const fieldErrors = result.ok ? {} : (result.fieldErrors ?? {});
  const [supplierId, setSupplierId] = useState(initialSupplierId);
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentDate, setPaymentDate] = useState(defaultDate);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const eligible = purchases.filter((purchase) => purchase.supplierId === supplierId);
  const allocated = useMemo(
    () =>
      Object.values(allocations).reduce((sum, value) => {
        try {
          return sum.plus(value || 0);
        } catch {
          return sum;
        }
      }, new Decimal(0)),
    [allocations],
  );
  let unallocated = new Decimal(0);
  try {
    unallocated = new Decimal(amount || 0).minus(allocated);
  } catch {
    /* server validates */
  }
  const payload = {
    supplierId,
    paymentMethodId,
    paymentDate,
    amount,
    reference,
    notes,
    allocations: eligible.flatMap((purchase) =>
      allocations[purchase.id]
        ? [{ purchaseId: purchase.id, amount: allocations[purchase.id] }]
        : [],
    ),
  };

  return (
    <form action={formAction} className="space-y-6">
      <input name="payload" type="hidden" value={JSON.stringify(payload)} />
      <FormMessage result={result} />
      <section className="card grid gap-5 p-6 sm:grid-cols-2">
        <FormField
          htmlFor="supplier"
          error={fieldErrors["supplierId"]?.[0]}
          label="Supplier"
          required
        >
          <select
            className="input"
            id="supplier"
            value={supplierId}
            onChange={(event) => {
              setSupplierId(event.target.value);
              setAllocations({});
            }}
            required
          >
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          htmlFor="method"
          error={fieldErrors["paymentMethodId"]?.[0]}
          label="Payment method"
          required
        >
          <select
            className="input"
            id="method"
            value={paymentMethodId}
            onChange={(event) => setPaymentMethodId(event.target.value)}
            required
          >
            <option value="">Select payment method</option>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          htmlFor="amount"
          error={fieldErrors["amount"]?.[0]}
          label="Amount (PKR)"
          required
        >
          <input
            className="input"
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </FormField>
        <FormField
          htmlFor="date"
          error={fieldErrors["paymentDate"]?.[0]}
          label="Payment date"
          required
        >
          <input
            className="input"
            id="date"
            type="date"
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.target.value)}
            required
          />
        </FormField>
        <FormField htmlFor="reference" error={fieldErrors["reference"]?.[0]} label="Reference">
          <input
            className="input"
            id="reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </FormField>
        <FormField htmlFor="notes" error={fieldErrors["notes"]?.[0]} label="Notes">
          <textarea
            className="input min-h-20"
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
      </section>
      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h2 className="font-semibold">Apply Payment to Purchases</h2>
          <p className="mt-1 text-sm text-slate-500">
            Leave any amount unallocated to record it on account.
          </p>
        </div>
        {supplierId && eligible.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Purchase</th>
                  <th>Date</th>
                  <th>Outstanding</th>
                  <th>Allocate</th>
                </tr>
              </thead>
              <tbody>
                {eligible.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>{purchase.purchaseNumber}</td>
                    <td>{purchase.purchaseDate}</td>
                    <td>PKR {purchase.outstanding}</td>
                    <td>
                      <input
                        className="input max-w-40"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={allocations[purchase.id] ?? ""}
                        onChange={(event) =>
                          setAllocations({ ...allocations, [purchase.id]: event.target.value })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-500">
            {supplierId
              ? "No unpaid finalized purchases. The payment can still be recorded fully on account."
              : "Select a supplier to view eligible purchases."}
          </div>
        )}
      </section>
      <section className="card ml-auto max-w-md space-y-2 p-5 text-sm">
        <div className="flex justify-between">
          <span>Payment</span>
          <strong>PKR {amount || "0.00"}</strong>
        </div>
        <div className="flex justify-between">
          <span>Allocated</span>
          <strong>PKR {allocated.toFixed(2)}</strong>
        </div>
        <div
          className={`flex justify-between border-t border-slate-200 pt-2 ${unallocated.isNegative() ? "text-red-700" : ""}`}
        >
          <span>Unallocated</span>
          <strong>PKR {unallocated.toFixed(2)}</strong>
        </div>
      </section>
      <div className="flex gap-3">
        <SubmitButton>Record Payment</SubmitButton>
        <Link className="btn-secondary" href="/purchases">
          Cancel
        </Link>
      </div>
    </form>
  );
}
